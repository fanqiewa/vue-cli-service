module.exports = class {
  constructor(parent) {
    this.parent = parent;
  }

  batch(handler) {
    handler(this);
    return this;
  }

  // 链式操作的回退
  end() {
    // Config
    return this.parent;
  }
};
