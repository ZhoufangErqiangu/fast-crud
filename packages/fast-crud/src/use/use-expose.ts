import { nextTick, Ref, toRaw } from "vue";
import {
  CrudExpose,
  Editable,
  EditableAddRowOptions,
  EditableEditColsOptions,
  OpenDialogProps,
  OpenEditContext,
  SetFormDataOptions
} from "../d/expose";
import _, { isArray } from "lodash-es";
import logger from "../utils/util.log";
import { useMerge } from "../use/use-merge";
import { useUi } from "../use/use-ui";
import { useI18n } from "../locale";
import {
  ColumnCompositionProps,
  CrudBinding,
  DoRemoveContext,
  Page,
  PageQuery,
  PageRes,
  RemoveProps,
  SearchOptions,
  UserPageQuery,
  UserPageRes
} from "../d";
import { useFormWrapper } from "./use-form";
import { forEachColumns } from "../use/use-columns";

const { merge } = useMerge();
const doMerge = merge;
export type UseExposeProps = {
  crudRef: Ref;
  crudBinding: Ref<CrudBinding>;
};

export type UseExposeRet = {
  expose: CrudExpose;
  crudExpose: CrudExpose;
};

export type UseEditableProps = {
  crudExpose: CrudExpose;
};

export type EditableOnEnabledProps = {
  editable: any;
};

function useEditable(props: UseEditableProps) {
  const { crudExpose } = props;
  const { crudBinding } = crudExpose;
  const { ui } = useUi();
  const { t } = useI18n();
  const { merge } = useMerge();
  const editable: Editable = {
    /**
     * 启用编辑
     * @param opts
     * @param onEnabled 默认根据mode切换rowHandle.active,[editRow,editable]
     */
    async enable(opts: any, onEnabled: (opts: EditableOnEnabledProps) => void) {
      const editableOpts = crudBinding.value.table.editable;
      merge(editableOpts, { enabled: true }, opts);
      if (onEnabled) {
        onEnabled({ editable: editableOpts });
      } else {
        if (editableOpts.mode === "row") {
          crudBinding.value.rowHandle.active = "editRow";
        } else {
          crudBinding.value.rowHandle.active = "editable";
        }
      }
    },
    /**
     * 禁用编辑
     */
    disable() {
      crudExpose.getTableRef()?.editable.resume();
      crudBinding.value.table.editable.enabled = false;
      crudBinding.value.rowHandle.active = "default";
    },
    /**
     * 激活所有编辑
     */
    active() {
      crudExpose.getTableRef().editable.active();
    },
    /**
     * 退出编辑
     */
    inactive() {
      crudExpose.getTableRef().editable.inactive();
    },
    /**
     * 添加行
     */
    addRow(opts: EditableAddRowOptions) {
      crudExpose.getTableRef().editable.addRow(opts);
    },
    editCol(opts: EditableEditColsOptions) {
      crudExpose.getTableRef().editable.editCol(opts);
    },
    /**
     * 还原，取消编辑
     */
    resume() {
      crudExpose.getTableRef().editable.resume();
    },
    removeRow(index: number) {
      crudExpose.getTableRef().editable.removeRow(index);
    },
    getEditableRow(index: number) {
      return crudExpose.getTableRef()?.editable?.getEditableRow(index);
    },
    async doSaveRow(opts: { index: number }) {
      const { index } = opts;
      const editableRow = editable.getEditableRow(index);
      editableRow.save({
        index,
        async doSave(opts: { isAdd: boolean; changed: boolean; row: any; setData: (data: any) => void }) {
          const { isAdd, changed, row, setData } = opts;
          if (crudBinding.value?.mode?.name === "local") {
            return;
          }
          try {
            editableRow.isLoading = true;
            if (isAdd) {
              const ret = await crudBinding.value.request.addRequest({ form: changed });
              setData(ret);
            } else {
              await crudBinding.value.request.editRequest({ form: changed, row });
            }
          } finally {
            editableRow.isLoading = false;
          }
        }
      });
    },
    async doCancelRow(opts: { index: number }) {
      const { index } = opts;
      const editableRow = editable.getEditableRow(index);
      editableRow.inactive();
    },
    async doRemoveRow(opts: { index: number }) {
      const index = opts.index;
      const row = editable.getEditableRow(index);
      const rowData = row.getRowData(index);
      const context = { index, row: rowData };
      await crudExpose.doRemove(context, {
        async handle() {
          if (row.isAdd) {
            editable.removeRow(index);
          } else {
            if (crudBinding.value.mode.name === "local") {
              editable.removeRow(index);
            } else {
              await crudBinding.value.request.delRequest({ row: rowData });
            }
          }
        }
      });
    },
    getInstance() {
      crudExpose.getTableRef().editable;
    }
  };
  return editable;
}

/**
 *
 * @param props
 */
export function useExpose(props: UseExposeProps): UseExposeRet {
  const { crudRef, crudBinding } = props;
  const { ui } = useUi();
  const { t } = useI18n();

  const formWrapperProvider = useFormWrapper();
  function checkCrudRef() {
    if (crudRef.value == null) {
      logger.warn("crudRef还未初始化，请在onMounted之后调用");
    }
  }
  function checkCrudBindingRef() {
    if (crudBinding.value == null) {
      logger.warn("crudBinding还未初始化，请在useFs或useCrud之后调用");
    }
  }

  const crudExpose: CrudExpose = {
    crudRef,
    crudBinding,

    getFormWrapperRef() {
      return crudRef.value.formWrapperRef;
    },
    getFormRef: () => {
      const formWrapperRef = crudExpose.getFormWrapperRef();
      if (formWrapperRef == null || formWrapperRef?.formRef == null) {
        logger.error(
          "当前无法获取FormRef，请在编辑对话框已打开的状态下调用此方法，如果是在打开对话框时调用，可以尝试先nextTick"
        );
        return;
      }
      return formWrapperRef?.formRef;
    },
    getFormData: () => {
      const formRef = crudExpose.getFormRef();
      return formRef?.getFormData();
    },
    setFormData: (form: any, options?: SetFormDataOptions) => {
      crudExpose.getFormRef()?.setFormData(form, options);
    },
    getFormComponentRef(key, isAsync = false) {
      const formRef = crudExpose.getFormRef();
      return formRef?.getComponentRef(key, isAsync);
    },
    doValueBuilder(records, columns) {
      if (columns == null) {
        columns = toRaw(crudBinding.value.columns);
      }
      logger.debug("doValueBuilder ,columns=", columns);
      const valueBuilderColumns: ColumnCompositionProps[] = [];
      forEachColumns(columns, (column) => {
        if (column.valueBuilder != null) {
          valueBuilderColumns.push(column);
        }
      });
      if (valueBuilderColumns.length === 0) {
        return;
      }
      _.forEach(records, (row, index) => {
        _.forEach(valueBuilderColumns, (col) => {
          col.valueBuilder({
            value: row[col.key],
            row,
            index,
            key: col.key,
            column: col
          });
        });

        //children
        if (row.children && isArray(row.children)) {
          crudExpose.doValueBuilder(row.children, columns);
        }
      });
      logger.debug("valueBuilder success:", records);
    },
    doValueResolve({ form }, columns) {
      if (columns == null) {
        columns = toRaw(crudBinding.value.columns);
      }
      const valueBuilderColumns: ColumnCompositionProps[] = [];
      forEachColumns(columns, (column) => {
        if (column.valueResolve != null) {
          valueBuilderColumns.push(column);
        }
      });
      if (valueBuilderColumns.length === 0) {
        return;
      }
      logger.debug("doValueResolve ,columns=", columns);
      _.forEach(valueBuilderColumns, (col) => {
        const key = col.key;
        col.valueResolve({
          value: form[key],
          row: form,
          form,
          key,
          column: col
        });
      });
      logger.debug("valueResolve success:", form);
    },
    doSearchValidate() {
      crudExpose.getSearchRef().doValidate();
    },
    getSearchFormData() {
      return crudBinding.value.search.validatedForm;
    },
    getSearchValidatedFormData() {
      return crudBinding.value.search.validatedForm;
    },
    /**
     * {form,mergeForm}
     */
    setSearchFormData(context) {
      if (context.mergeForm === false) {
        for (const key in crudBinding.value.search.validatedForm) {
          delete crudBinding.value.search.validatedForm[key];
        }
      }
      const { merge } = useMerge();
      merge(crudBinding.value.search.validatedForm, context.form);
      if (context.triggerSearch) {
        crudExpose.doRefresh();
      }
    },
    /**
     * 获取search组件ref
     */
    getSearchRef() {
      checkCrudRef();
      return crudRef.value?.getSearchRef();
    },

    buildPageQuery(pageQuery: PageQuery): UserPageQuery {
      const page = pageQuery.page;

      let searchFormData = pageQuery.form;
      if (searchFormData == null) {
        searchFormData = _.cloneDeep(crudExpose.getSearchValidatedFormData());
        //配置searchValueResolve
        if (crudBinding.value?.search?.columns) {
          crudExpose.doValueResolve({ form: searchFormData }, toRaw(crudBinding.value.search.columns));
        }
      }

      let sort = pageQuery.sort;
      if (sort == null) {
        sort = crudBinding.value.table.sort || {};
      }

      const query: PageQuery = { page, form: searchFormData, sort };
      let userPageQuery: UserPageQuery = query;
      if (crudBinding.value.request.transformQuery) {
        userPageQuery = crudBinding.value.request.transformQuery(query);
      }
      return userPageQuery;
    },

    async search(pageQuery: PageQuery, options: SearchOptions = {}) {
      const userPageQuery = crudExpose.buildPageQuery(pageQuery);
      let userPageRes: UserPageRes;
      try {
        if (options.silence !== true) {
          crudBinding.value.table.loading = true;
        }

        logger.debug("pageRequest", userPageQuery);
        userPageRes = await crudBinding.value.request.pageRequest(userPageQuery);
      } finally {
        if (options.silence !== true) {
          crudBinding.value.table.loading = false;
        }
      }
      if (userPageRes == null) {
        logger.warn("pageRequest返回结果不能为空");
        return;
      }
      let pageRes: PageRes = userPageRes as PageRes;
      if (crudBinding.value.request.transformRes) {
        pageRes = crudBinding.value.request.transformRes({
          res: userPageRes,
          query: userPageQuery
        });
      }

      //valueBuild
      if (pageRes.records) {
        crudExpose.doValueBuilder(pageRes.records);
      }
      return pageRes;
    },
    getPage() {
      let page: Page = {
        currentPage: 1,
        pageSize: 10
      };
      if (crudBinding.value.pagination) {
        page = {
          currentPage: crudBinding.value.pagination[ui.pagination.currentPage],
          pageSize: crudBinding.value.pagination.pageSize
        };
      }
      return page;
    },
    async doRefresh(props?) {
      if (crudBinding.value.request.pageRequest == null) {
        return;
      }
      logger.debug("do refresh:", props);
      if (crudBinding.value.pagination) {
        if (props?.goFirstPage) {
          crudBinding.value.pagination[ui.pagination.currentPage] = 1;
        }
      }

      const page = crudExpose.getPage();
      const pageRes = await crudExpose.search({ page }, { silence: props?.silence });
      const { currentPage = page.currentPage, pageSize = page.pageSize, total } = pageRes;
      const { records } = pageRes;
      if (
        records == null ||
        total == null ||
        currentPage == null ||
        currentPage <= 0 ||
        isNaN(currentPage) ||
        pageSize == null ||
        pageSize <= 0 ||
        isNaN(pageSize)
      ) {
        logger.error(
          "pageRequest返回结构不正确，请配置正确的request.transformRes，期望：{currentPage>0, pageSize>0, total, records:[]},实际返回：",
          pageRes
        );
        return;
      }
      crudBinding.value.data = records;
      if (crudBinding.value.pagination) {
        crudBinding.value.pagination[ui.pagination.currentPage] = currentPage;
        crudBinding.value.pagination.pageSize = pageSize;
        crudBinding.value.pagination[ui.pagination.total] = total || records.length;
      }
      if (crudBinding.value?.table?.onRefreshed) {
        crudBinding.value.table.onRefreshed({
          data: records
        });
      }
    },

    /**
     * 获取toolbar组件Ref
     */
    getToolbarRef: () => {
      return crudRef.value.toolbarRef;
    },

    /**
     * 获取列设置组件Ref
     */
    getColumnsFilterRef: () => {
      return crudExpose.getToolbarRef().columnsFilterRef;
    },

    /**
     * 获取列设置的原始列配置Ref
     * 可以修改列设置的原始配置
     */
    getColumnsFilterOriginalColumnsRef: () => {
      return crudExpose.getColumnsFilterRef().original;
    },
    /**
     * 获取列设置的列配置Ref
     * 可以动态修改列设置每列的配置
     */
    getColumnsFilterColumnsRef: () => {
      return crudExpose.getColumnsFilterRef().columns;
    },

    doPageTurn(no: number) {
      crudBinding.value.pagination[ui.pagination.currentPage] = no;
    },
    /**
     *
     * @param opts = {
     *   form
     *   goFirstPage =true
     *   mergeForm=false
     * }
     */
    async doSearch(opts: { form?: any; goFirstPage?: boolean; mergeForm?: boolean }) {
      logger.debug("do search:", opts);
      opts = merge({ goFirstPage: true }, opts);
      if (opts.goFirstPage) {
        crudExpose.doPageTurn(1);
      }
      if (opts.form && crudRef.value) {
        crudRef.value.setSearchFormData(opts);
        crudExpose.setSearchFormData({ form: opts.form, mergeForm: opts.mergeForm, refWarning: false });
      }

      await crudExpose.doRefresh();
    },
    /**
     * 获取FsTable实例
     */
    getTableRef() {
      checkCrudRef();
      return crudRef.value?.tableRef;
    },
    /**
     * 获取x-Table实例
     */
    getBaseTableRef() {
      const tableRef = this.getTableRef();
      if (tableRef == null) {
        logger.warn("fs-table还未挂载");
        return;
      }
      return tableRef.tableRef;
    },
    /**
     * 获取表格数据
     */
    getTableData() {
      checkCrudBindingRef();
      return crudBinding.value.data;
    },
    setTableData(data: any[]) {
      checkCrudBindingRef();
      crudBinding.value.data = data;
    },
    insertTableRow(index: number, row: any) {
      checkCrudBindingRef();
      crudBinding.value.data.splice(index, 0, row);
    },
    updateTableRow(index: number, row: any, merge = true) {
      if (merge) {
        crudBinding.value.data[index] = doMerge(crudBinding.value.data[index], row);
      } else {
        crudBinding.value.data[index] = row;
      }
    },
    removeTableRow(index: number) {
      checkCrudBindingRef();
      crudBinding.value.data.splice(index, 1);
    },
    getTableDataRow(index: number) {
      const data = crudExpose.getTableData();
      if (data == null) {
        throw new Error("table data is not init");
      }
      if (data.length <= index) {
        throw new Error("index over array length");
      }
      return data[index];
    },
    /**
     * 选择某一行
     * @param index
     * @param row
     */
    doSelectCurrentRow({ row }: { row: any }) {
      const tableRef = crudExpose.getTableRef();
      tableRef.value.setCurrentRow(row);
    },
    /**
     * 删除行按钮
     * @param context
     * @param opts
     */
    async doRemove(context: DoRemoveContext, opts?: RemoveProps) {
      const removeBinding: any = crudBinding.value.table.remove ?? opts ?? {};
      try {
        if (removeBinding.confirmFn) {
          await removeBinding.confirmFn(context);
        } else {
          await ui.messageBox.confirm({
            title: removeBinding.confirmTitle || t("fs.rowHandle.remove.confirmTitle"), // '提示',
            message: removeBinding.confirmMessage || t("fs.rowHandle.remove.confirmMessage"), // '确定要删除此记录吗?',
            type: "warn"
          });
        }
      } catch (e) {
        if (removeBinding.onCanceled) {
          await removeBinding.onCanceled(context);
        }
        return;
      }
      let res = null;
      const isLocal = crudBinding.value.mode?.name === "local";
      if (opts?.handler) {
        await opts.handler(context);
      } else {
        if (isLocal) {
          crudExpose.removeTableRow(context?.index);
        } else {
          res = await crudBinding.value.request.delRequest(context);
        }
      }

      if (removeBinding.showSuccessNotification !== false) {
        ui.notification.success(t("fs.rowHandle.remove.success"));
      }

      if (!isLocal) {
        if (removeBinding.refreshTable !== false) {
          await crudExpose.doRefresh();
        }
      }

      if (removeBinding.onRemoved) {
        await removeBinding.onRemoved({ ...context, res });
      }
    },
    /**
     *
     * 打开表单对话框
     * @param formOpts ={mode, initialForm: row, index,...formOptions}
     */
    async openDialog(formOpts: OpenDialogProps) {
      if (formOpts.newInstance === true && formWrapperProvider) {
        //通过新实例打开
        return await formWrapperProvider.openDialog(formOpts);
      }
      const formWrapperRef = this.getFormWrapperRef();
      formWrapperRef.open(formOpts);
      return formWrapperRef;
    },
    async _openDialog(mode: string, context: OpenEditContext, formOpts: OpenDialogProps) {
      const { merge } = useMerge();
      // @ts-ignore
      let row = context.row || context[ui.tableColumn.row];
      delete context.row;
      if (row == null && context.index != null) {
        row = crudExpose.getTableDataRow(context.index);
      }
      if (crudBinding.value?.request?.infoRequest) {
        row = await crudBinding.value.request.infoRequest({ mode, row });
      }
      const options = {
        mode
      };
      const xxForm = toRaw(crudBinding.value[mode + "Form"]);
      merge(options, xxForm, { initialForm: row }, context, formOpts);
      return await this.openDialog(options);
    },
    async openAdd(context: OpenEditContext, formOpts: OpenDialogProps = {}) {
      return this._openDialog("add", context, formOpts);
    },
    async openEdit(context: OpenEditContext, formOpts: OpenDialogProps = {}) {
      return this._openDialog("edit", context, formOpts);
    },
    async openView(context: OpenEditContext, formOpts: OpenDialogProps = {}) {
      return this._openDialog("view", context, formOpts);
    },

    editable: undefined
  };
  crudExpose.editable = useEditable({ crudExpose });
  return { expose: crudExpose, crudExpose: crudExpose };
}
