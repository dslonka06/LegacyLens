class RepositoryScannerEngine {

  scan(files) {
    const root = this.buildTree(files);
    const maxDepth = this.measureDepth(root, 0);

    return {
      root,
      projects: [],  // populated by ProjectDiscoveryEngine after scan
      maxDepth,
      totalFileCount: files.length,
    };
  }

  buildTree(files) {
    const root = {
      name: '',
      path: '',
      children: [],
      files: [],
      totalFileCount: 0,
    };

    for (const file of files) {
      const normalized = file.path.replace(/\\/g, '/');
      const segments = normalized.split('/');

      if (segments.length === 1) {
        // File sits at the root level
        root.files.push(this.toFileNode(file));
      } else {
        // Walk/create the folder path, placing the file at the leaf
        const folderSegments = segments.slice(0, -1);
        this.ensureFolderPath(root, folderSegments, file.path).files.push(
          this.toFileNode(file)
        );
      }
    }

    this.computeFileCounts(root);
    return root;
  }

  ensureFolderPath(current, segments, originalPath) {
    if (segments.length === 0) return current;

    const [head, ...tail] = segments;
    let child = current.children.find(c => c.name === head);

    if (!child) {
      const parentPath = current.path ? `${current.path}/${head}` : head;
      child = {
        name: head,
        path: parentPath,
        children: [],
        files: [],
        totalFileCount: 0,
      };
      current.children.push(child);
    }

    return tail.length === 0 ? child : this.ensureFolderPath(child, tail, originalPath);
  }

  toFileNode(file) {
    return {
      name: file.name,
      path: file.path,
      extension: file.extension,
      language: file.language,
      size: file.size,
    };
  }

  computeFileCounts(folder) {
    const childCounts = folder.children.reduce(
      (sum, child) => sum + this.computeFileCounts(child),
      0
    );
    folder.totalFileCount = folder.files.length + childCounts;
    return folder.totalFileCount;
  }

  measureDepth(folder, currentDepth) {
    if (folder.children.length === 0) return currentDepth;
    return Math.max(
      ...folder.children.map(c => this.measureDepth(c, currentDepth + 1))
    );
  }
}

module.exports = { RepositoryScannerEngine };
