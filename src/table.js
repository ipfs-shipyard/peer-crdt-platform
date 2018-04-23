const UUID = require('uuid/v4');

class Table {

  constructor(app, name, structure) {
    this.app = app;
    this.name = name;
    this.crdt = this.app.tableData[name];
    this.data = {};
    this.index = {};
    this.structure = structure;
    this.def = structure.def;
    this.indexFields = new Set(this.structure.index || []);
    for (const field of this.indexFields) {
      this.index[field] = {};
    }

    this.crdt.on('change', (e) => {

      if (e.type === 'set' && e.value._action !== 'delete') {
        this.data[e.value_id] = e.value;
        for (const field of this.indexFields) {
          if (!this.index[field].hasOwnProperty(e.value._id)) {
            this.index[field][e.value._id] = new Set([]);
          }
          this.index[field][e.value._id].add(e.value[field]);
        }
      } else if (e.type === 'set' && e.value._action === 'delete') {
        delete this.data[e.value._id];
        if (this.index[field].hasOwnProperty(e.value._id)) {
          this.index[field][e.value._id].delete(e.value[field]);
        }
      }
    });
  }

  insert(row) {

    const rowId = new UUID();
    this.crdt.set(rowId, row);
    return rowId;
  }

  delete(id) {

    this.crdt.set(id, { _action: 'delete' });
  }

  replace(id, row) {

    this.crdt.set(id, row);
    return rowId;
  }

  select(id) {

    return this.data[id];
  }

  find(args) {
  }

  where(args, order) {
  }

  count() {
  }
}

modules.export = Table;
