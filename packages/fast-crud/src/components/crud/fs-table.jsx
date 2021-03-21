import {
  resolveDynamicComponent,
  getCurrentInstance,
  ref,
  h,
  withDirectives,
  resolveDirective,
} from "vue";
import _ from "lodash-es";
import FsRowHandle from "./fs-row-handle.vue";
import FsComponentRender from "../render/fs-component-render";
import "./fs-table.less";
export default {
  name: "FsTable",
  components: { FsComponentRender, FsRowHandle },
  props: {
    slots: {},
    columns: {},
    rowHandle: {},
    show: {},
    data: {},
  },
  emits: ["rowHandle"],
  setup() {
    const tableRef = ref();
    return {
      tableRef,
    };
  },
  methods: {
    onRowHandle(context) {
      this.$emit("rowHandle", context);
    },
  },
  render() {
    if (this.show === false) {
      return;
    }
    const { proxy } = getCurrentInstance();
    const tableComp = resolveDynamicComponent(proxy.$fsui.table.name);

    const tableSlots = {};

    const templateMode = true;
    const tableColumnCI = proxy.$fsui.tableColumn;
    if (templateMode) {
      const tableColumnComp = resolveDynamicComponent(tableColumnCI.name);
      const tableColumnGroupComp = resolveDynamicComponent(
        proxy.$fsui.tableColumnGroup.name
      );

      function getContextFn(item, scope) {
        const row = scope[tableColumnCI.row];
        const form = row;
        return { ...scope, key: item.key, value: row[item.key], row, form };
      }

      tableSlots.default = () => {
        const children = [];
        const buildColumn = (item) => {
          let cellSlots = {};
          let currentTableColumnComp = tableColumnComp;
          if (item.children && item.children.length > 0) {
            cellSlots.default = () => {
              const subColumns = [];
              _.forEach(item.children, (subColumn) => {
                if (subColumn.show === false) {
                  return;
                }
                subColumns.push(buildColumn(subColumn));
              });
              return subColumns;
            };
            currentTableColumnComp = tableColumnGroupComp;
          } else if (this.slots && this.slots["cell_" + item.key]) {
            cellSlots.default = (scope) => {
              this.slots["cell_" + item.key](scope);
            };
          } else if (item.component) {
            cellSlots.default = (scope) => {
              const newScope = getContextFn(item, scope);
              const getScopeFn = () => {
                return newScope;
              };
              const vModel = {
                modelValue: scope[tableColumnCI.row][item.key],
                "onUpdate:modelValue": (value) => {
                  scope[tableColumnCI.row][item.key] = value;
                },
              };
              return (
                <fs-cell
                  component={item.component}
                  getScope={getScopeFn}
                  {...vModel}
                />
              );
            };
          } else if (item.formatter) {
            cellSlots.default = (scope) => {
              const newScope = getContextFn(item, scope);
              return item.formatter(newScope);
            };
          } else {
            cellSlots = null;
          }
          const newItem = { ...item };
          delete newItem.children;

          return (
            <currentTableColumnComp
              {...newItem}
              label={item.title}
              prop={item.key}
              dataIndex={item.key}
              v-slots={cellSlots}
            />
          );
        };
        _.forEach(this.columns, (item) => {
          if (item.show === false) {
            return;
          }
          children.push(buildColumn(item));
        });

        // rowHandle
        if (this.rowHandle && this.rowHandle.show !== false) {
          const rowHandleSlots = {
            default: (scope) => {
              return (
                <fs-row-handle
                  {...this.rowHandle}
                  scope={scope}
                  onHandle={this.onRowHandle}
                />
              );
            },
          };
          children.push(
            <tableColumnComp
              {...this.rowHandle}
              label={this.rowHandle.title}
              prop={this.rowHandle.key || "rowHandle"}
              v-slots={rowHandleSlots}
            />
          );
        }
        return children;
      };
    }
    const dataSource = {
      [proxy.$fsui.table.data]: this.data,
    };

    const tableRender = (
      <tableComp
        ref={"tableRef"}
        {...this.$attrs}
        {...dataSource}
        v-slots={tableSlots}
      />
    );
    if (proxy.$fsui.table.vLoading) {
      const loading = resolveDirective(proxy.$fsui.table.vLoading);
      return withDirectives(tableRender, [[loading, this.$attrs.loading]]);
    }
    return tableRender;
  },
};