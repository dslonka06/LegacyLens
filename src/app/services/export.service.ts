import { inject, Injectable } from '@angular/core';
import { ModifiedFile } from '../models/modified-file.model';
import { WorkspaceManagerService } from './workspace-manager.service';

@Injectable({ providedIn: 'root' })
export class ExportService {

  private readonly manager = inject(WorkspaceManagerService);

  exportSingleFile(file: ModifiedFile): void {
    const blob = new Blob([file.modifiedContent], { type: 'text/plain' });
    this.triggerDownload(blob, `Modified${file.fileName}`);
    this.manager.setChangeStatus(file.workspaceId, file.id, 'exported');
  }

  exportAsZip(approved: ModifiedFile[], zipName: string): void {
    if (!approved.length) return;
    const blob = this.buildZip(approved);
    this.triggerDownload(blob, zipName);
    for (const f of approved) {
      this.manager.setChangeStatus(f.workspaceId, f.id, 'exported');
    }
  }

  // ── ZIP builder ────────────────────────────────────────────────────────────

  private buildZip(files: ModifiedFile[]): Blob {
    const enc = new TextEncoder();
    const parts: Uint8Array<ArrayBuffer>[] = [];
    const centralDir: Uint8Array<ArrayBuffer>[] = [];
    let offset = 0;

    for (const f of files) {
      // Normalise path: strip leading slashes, use forward slashes
      const entryName = f.filePath.replace(/\\/g, '/').replace(/^\/+/, '') || f.fileName;
      const nameBytes    = enc.encode(entryName);
      const contentBytes = enc.encode(f.modifiedContent);
      const crc          = this.crc32(contentBytes);
      const size         = contentBytes.length;
      const date         = this.dosDateTime(new Date(f.modifiedAt));

      // ── Local file header (30 bytes + name + content) ──────────────────────
      const local = new Uint8Array(30 + nameBytes.length + size);
      const lv = new DataView(local.buffer);
      lv.setUint32(0,  0x504b0304, true); // signature
      lv.setUint16(4,  20,         true); // version needed: 2.0
      lv.setUint16(6,  0,          true); // flags
      lv.setUint16(8,  0,          true); // method: stored
      lv.setUint16(10, date.time,  true); // mod time
      lv.setUint16(12, date.date,  true); // mod date
      lv.setUint32(14, crc,        true); // CRC-32
      lv.setUint32(18, size,       true); // compressed size
      lv.setUint32(22, size,       true); // uncompressed size
      lv.setUint16(26, nameBytes.length, true); // filename length
      lv.setUint16(28, 0,          true); // extra field length
      local.set(nameBytes,    30);
      local.set(contentBytes, 30 + nameBytes.length);
      parts.push(local);

      // ── Central directory entry (46 bytes + name) ─────────────────────────
      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0,  0x504b0102, true); // signature
      cv.setUint16(4,  20,         true); // version made by
      cv.setUint16(6,  20,         true); // version needed
      cv.setUint16(8,  0,          true); // flags
      cv.setUint16(10, 0,          true); // method: stored
      cv.setUint16(12, date.time,  true); // mod time
      cv.setUint16(14, date.date,  true); // mod date
      cv.setUint32(16, crc,        true); // CRC-32
      cv.setUint32(20, size,       true); // compressed size
      cv.setUint32(24, size,       true); // uncompressed size
      cv.setUint16(28, nameBytes.length, true); // filename length
      cv.setUint16(30, 0,          true); // extra field length
      cv.setUint16(32, 0,          true); // comment length
      cv.setUint16(34, 0,          true); // disk number start
      cv.setUint16(36, 0,          true); // internal attributes
      cv.setUint32(38, 0,          true); // external attributes
      cv.setUint32(42, offset,     true); // relative offset of local header
      cd.set(nameBytes, 46);
      centralDir.push(cd);

      offset += local.length;
    }

    // ── End of Central Directory record (22 bytes) ─────────────────────────
    const cdSize   = centralDir.reduce((s, c) => s + c.length, 0);
    const eocd     = new Uint8Array(22);
    const ev       = new DataView(eocd.buffer);
    ev.setUint32(0,  0x504b0506, true); // signature
    ev.setUint16(4,  0,          true); // disk number
    ev.setUint16(6,  0,          true); // disk with CD start
    ev.setUint16(8,  files.length, true); // entries on disk
    ev.setUint16(10, files.length, true); // total entries
    ev.setUint32(12, cdSize,     true); // CD size
    ev.setUint32(16, offset,     true); // CD offset
    ev.setUint16(20, 0,          true); // comment length

    return new Blob([...parts, ...centralDir, eocd], { type: 'application/zip' });
  }

  // ── CRC-32 ─────────────────────────────────────────────────────────────────

  private readonly crcTable = this.buildCrcTable();

  private buildCrcTable(): Uint32Array {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[i] = c;
    }
    return t;
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc = this.crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // ── DOS date/time encoding ─────────────────────────────────────────────────

  private dosDateTime(d: Date): { time: number; date: number } {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >>> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  // ── Download trigger ───────────────────────────────────────────────────────

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
