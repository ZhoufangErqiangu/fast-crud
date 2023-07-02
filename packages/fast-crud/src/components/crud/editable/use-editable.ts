import _ from "lodash-es";
import { computed, reactive, watch } from "vue";
import { uiContext } from "../../../ui";
import { useMerge } from "../../../use";

// import { useValidation } from "./validation/use-validation";

function useTableData(props: any, tableRef: any) {
  const ui = uiContext.get();

  function getData() {
    if (props.data) {
      return props.data;
    }
    if (tableRef.value) {
      return tableRef.value[ui.table.data];
    }
    return [];
  }

  return {
    getData,
    insert(index: number, row: any) {
      getData().splice(index, 0, row);
    },
    unshift(row: any) {
      getData().unshift(row);
    },
    remove(index: number) {
      getData().splice(index, 1);
    },
    get(index: number) {
      return getData()[index];
    }
  };
}

export function useEditable(props: any, ctx: any, tableRef: any) {
  const tableData = useTableData(props, tableRef);
  const editableRows = reactive([]);
  const actionHistory = reactive([]);

  function editableRowsEach(call: (opts: any) => any) {
    for (let i = 0; i < editableRows.length; i++) {
      const row = editableRows[i];
      const cells = row.cells;
      const rowData = tableData.get(i);
      const res = call({ rowData, row, cells, index: i });
      if (res === "break") {
        return;
      }
    }
  }

  function editableEach(call: (opts: any) => any) {
    editableRowsEach(({ rowData, row, cells, index }) => {
      _.forEach(cells, (cell, key) => {
        call({ rowData, row, cells, cell, index, key });
      });
    });
  }

  const { merge } = useMerge();
  // editable
  const options = computed(() => {
    return merge(
      {
        rowKey: "id",
        enabled: false,
        addForm: {},
        editForm: {},
        mode: "free", //模式，free，row
        exclusive: true, //是否排他式激活，激活一个，关闭其他
        activeTrigger: "onClick", //激活触发方式,onClick,onDbClick,false
        activeDefault: false,
        isEditable(opts: { index: number; key: string; row: any }) {
          return true;
        },
        cell: {
          check: {},
          cancel: {},
          edit: {}
        }
      },
      props.editable
    );
  });

  function createEditableCell(tableRow: any, key: string, index: number) {
    function getValue(key: string) {
      return tableRow[key];
    }

    function setValue(key: string, value: any) {
      tableRow[key] = value;
    }

    const cell: any = reactive({
      isEditing: options.value.activeDefault,
      activeTrigger: options.value.activeTrigger
    });
    cell.isEditable = () => {
      return options.value.isEditable({ index, key, row: tableRow });
    };
    cell.isChanged = () => {
      return cell.newValue !== cell.oldValue;
    };
    cell.getForm = () => {
      let form = options.value[cell.mode + "Form"];
      if (form == null) {
        form = options.value.editForm;
      }
      return form[key];
    };
    cell.active = (opts: any = {}) => {
      const exclusive = opts.exclusive ?? options.value.exclusive;
      if (exclusive) {
        inactive();
      }
      cell.isEditing = true;
      if (cell.oldValue === undefined) {
        cell.oldValue = getValue(key);
      }
    };
    cell.inactive = () => {
      cell.isEditing = false;
      cell.newValue = getValue(key);
    };
    cell.resume = () => {
      cell.isEditing = false;
      if (cell.isChanged()) {
        setValue(key, cell.oldValue);
        delete cell.newValue;
        delete cell.oldValue;
      }
    };
    cell.persist = () => {
      cell.isEditing = false;
      delete cell.newValue;
      delete cell.oldValue;
    };
    return cell;
  }

  function eachTree(tree: any, callback: any) {
    _.forEach(tree, (item) => {
      if (item.children) {
        eachTree(item.children, callback);
      } else {
        callback(item);
      }
    });
  }
  function createEditableRow(index: number, rowData: any) {
    const cells: any = {};
    eachTree(props.columns, (item: any) => {
      const config = item.editable ?? {};
      let disabled = config.disabled ?? false;
      if (disabled instanceof Function) {
        disabled = config.disabled({ column: item, index, row: rowData });
      }
      if (disabled !== true) {
        cells[item.key] = createEditableCell(rowData, item.key, index);
      }
    });
    const editableRow: any = (editableRows[index] = reactive({ cells }));

    editableRow.inactive = () => {
      editableRow.isEditing = false;
      _.forEach(editableRow.cells, (cell) => {
        if (cell.isEditing) {
          cell.inactive();
        }
      });
    };

    editableRow.active = () => {
      editableRow.isEditing = true;
      _.forEach(editableRow.cells, (cell) => {
        cell.active({ exclusive: false });
      });
    };

    editableRow.persist = () => {
      editableRow.inactive();
      delete editableRow.isAdd;
      _.forEach(editableRow.cells, (cell) => {
        cell.persist();
      });
    };
    editableRow.resume = () => {
      _.forEach(editableRow.cells, (cell) => {
        cell.resume();
      });
    };

    editableRow.save = async (opts: { index: number; doSave: (opts: any) => Promise<void> }) => {
      const { index, doSave } = opts;
      const changed = editableRow.getChangeData(index);
      const row = tableData.get(index);
      const { merge } = useMerge();
      function setData(newRow: any) {
        if (newRow) {
          merge(row, newRow);
        }
      }

      await doSave({ isAdd: editableRow.isAdd, index, changed, row, setData });
      editableRow.persist();
    };

    editableRow.getRowData = (index: number) => {
      return tableData.get(index);
    };
    editableRow.getChangeData = (index: number) => {
      editableRow.inactive();
      const row = editableRow;
      const rowData = tableData.get(index);
      if (row.isAdd) {
        return rowData;
      }
      const id = rowData[options.value.rowKey];
      const changed: any = { [options.value.rowKey]: id };
      _.forEach(row.cells, (cell, key) => {
        if (cell.isChanged()) {
          changed[key] = cell.newValue;
        }
      });
      return changed;
    };
    return editableRow;
  }

  function unshiftEditableRow(rowData: any, index = 0) {
    editableRows.splice(index, 0, { cells: {} });
    return createEditableRow(index, rowData);
  }

  function setupEditable(data?: any) {
    if (data == null) {
      data = tableData.getData();
    }
    editableRows.length = 0;
    _.forEach(data, (rowData: any, index: number) => {
      createEditableRow(index, rowData);
    });
    if (options.value.onSetup) {
      options.value.onSetup();
    }
  }

  watch(
    () => {
      return props["data"];
    },
    (data) => {
      if (options.value.enabled) {
        setupEditable(data);
      }
    },
    {
      immediate: true
    }
  );
  watch(
    () => {
      return options.value.enabled;
    },
    (value) => {
      if (value) {
        if (tableData.getData()?.length > 0) {
          setupEditable();
        }

        if (options.value.onEnabled) {
          options.value.onEnabled({ ...options.value });
        }
      }
    },
    {
      immediate: true
    }
  );
  watch(
    () => {
      return options.value.mode;
    },
    () => {
      if (options.value.onEnabled) {
        options.value.onEnabled({ ...options.value });
      }
    }
  );

  function getEditableCell(index?: number, key?: string) {
    if (key == null || index < 0) {
      return {};
    }
    return editableRows[index]?.cells[key];
  }

  /**
   * 全部进入编辑状态
   */
  function active() {
    editableEach(({ cell }) => {
      cell.active({ exclusive: false });
    });
  }

  /**
   * 全部取消编辑状态
   */
  function inactive() {
    editableEach(({ cell }) => {
      if (cell.isEditing) {
        cell.inactive();
      }
    });
  }

  /**
   * 获取改变的数据
   * @returns {[]}
   */
  function getChangedData() {
    const changedRows: any[] = [];
    const removedRows: any[] = [];
    editableRowsEach(({ rowData, row, cells }) => {
      const id = rowData[options.value.rowKey];
      const changed: any = { [options.value.rowKey]: id };
      let hasChange = row.isAdd || false;
      _.forEach(cells, (cell, key) => {
        if (cell.isChanged()) {
          changed[key] = cell.newValue;
          hasChange = true;
        }
      });
      if (hasChange) {
        changedRows.push(changed);
      }
    });
    _.forEach(actionHistory, (item) => {
      if (item.type === "add" || item.editableRow?.isAdd) {
        return;
      }
      removedRows.push(item.dataRow);
    });
    return {
      changed: changedRows,
      removed: removedRows
    };
  }

  /**
   * 固化
   */
  function persist() {
    inactive();
    editableRowsEach(({ row }) => {
      delete row.isAdd;
    });
    editableEach(({ cell }) => {
      delete cell.newValue;
      delete cell.oldValue;
    });
    actionHistory.length = 0;
  }

  function resumeLast() {
    const action = actionHistory.pop();
    const type = action.type;
    const index = action.index;
    const dataRow = action.dataRow;
    const editableRow = action.editableRow;
    if (type === "add") {
      editableRows.splice(index, 1);
      tableData.remove(index);
    } else {
      editableRows.splice(index, 0, editableRow);
      tableData.insert(index, dataRow);
    }
  }

  /**
   * 还原
   */
  function resume() {
    // 反激活所有cell
    inactive();

    //根据操作记录恢复
    while (actionHistory.length > 0) {
      resumeLast();
    }
    // 恢复被修改过的数据
    editableEach(({ cell }) => {
      cell.resume();
    });
  }

  async function submit(call: (opts: any) => any) {
    inactive();
    const changed = getChangedData();

    function setData(list: any[]) {
      _.forEach(list, (row, index) => {
        merge(tableData.get(index), row);
      });
    }

    await call({ ...changed, setData });
    persist();
  }

  function hasDirty() {
    let dirty = false;
    editableRowsEach(({ cells }) => {
      _.forEach(cells, (cell) => {
        if (cell.isChanged()) {
          dirty = true;
          return "break";
        }
      });
    });
    return dirty;
  }

  let addIndex = 0;

  function addRow(opts: { row: any; active: boolean } = { row: undefined, active: true }) {
    const row = opts.row || { [options.value.rowKey]: --addIndex };
    if (opts.row === undefined) {
      for (let i = 0; i < props.columns.length; i++) {
        const value = props.columns[i].value;
        if (value || value === 0) {
          row[props.columns[i].key] = value;
        }
      }
    }

    let index = 0;
    if (props.editable.addRow) {
      index = props.editable.addRow(tableData.getData(), row);
    } else {
      tableData.unshift(row);
    }
    const firstRow = unshiftEditableRow(row, index);
    firstRow.isAdd = true;
    if (opts.active !== false) {
      firstRow.isEditing = true;
      firstRow.active();
    }

    actionHistory.push({
      type: "add",
      index: 0
    });
  }

  function removeRow(index: number) {
    const editableRow = editableRows[index];
    //把删除部分的数据临时保存起来
    actionHistory.push({
      type: "remove",
      index,
      dataRow: tableData.get(index),
      editableRow
    });
    editableRows.splice(index, 1);
    tableData.remove(index);
  }

  function editCol(opts: { cols: any[] }) {
    const { cols } = opts;
    editableRowsEach(({ cells }) => {
      _.forEach(cols, (key) => {
        cells[key].active({ exclusive: false });
      });
    });
  }

  function getEditableRow(index: number) {
    return editableRows[index];
  }

  return {
    editable: {
      options,
      setupEditable,
      inactive,
      active,
      getChangedData,
      persist,
      submit,
      resume,
      addRow,
      removeRow,
      getEditableRow,
      editCol,
      hasDirty,
      getEditableCell
    }
  };
}
