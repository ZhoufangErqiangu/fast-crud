import { computed, defineComponent } from "vue";
import { uiContext } from "../../../ui";
import { useCompute } from "../../../use/use-compute";
import "./fs-editable-cell.less";
/**
 * 可编辑单元格组件
 */
export default defineComponent({
  name: "FsEditableCell",
  inheritAttrs: false,
  props: {
    /**
     * 组件配置
     */
    item: {},
    scope: {},
    index: {},
    columnKey: {},
    editable: {}
  },
  setup(props: any, ctx: any) {
    const ui = uiContext.get();
    // const getEditable = inject("get:editable");
    const { doComputed } = useCompute();

    // let editable = getEditable(props.index, props.columnKey);
    if (props.index === -1) {
      return () => {};
    }

    const getFormRefFunc = () => {
      return props.editable?.getForm();
    };

    const computedForm = doComputed(getFormRefFunc, () => {
      return props.scope;
    });

    const computedIsEditable = computed(() => {
      return computedForm.value && computedForm.value.show !== false && props.editable?.isEditable();
    });

    return () => {
      if (!computedIsEditable.value) {
        return <fs-cell ref={"targetRef"} item={props.item} scope={props.scope} {...ctx.attrs} />;
      }
      const editable = props.editable;

      if (editable?.isEditing) {
        let editIcon = null;
        if (props.editable?.activeTrigger) {
          editIcon = (
            <div key={props.index} class={"fs-cell-edit-action"}>
              <fs-icon size={"mini"} icon={ui.icons.check} onClick={editable.inactive} />
              <fs-icon size={"mini"} icon={ui.icons.close} onClick={editable.resume} />
            </div>
          );
        }

        let inputComponent = null;
        const scopeFunc = () => {
          return props.scope;
        };
        if (computedForm.value.blank === false || computedForm.value.component?.show === false) {
          inputComponent = null;
        } else if (
          computedForm.value.conditionalRender &&
          computedForm.value.conditionalRender.match &&
          computedForm.value.conditionalRender.match(scopeFunc())
        ) {
          inputComponent = (
            <fs-render render-func={computedForm.value.conditionalRender.render} scope={scopeFunc()} {...ctx.attrs} />
          );
        } else if (computedForm.value.render) {
          inputComponent = <fs-render render-func={computedForm.value.render} scope={scopeFunc()} {...ctx.attrs} />;
        } else {
          inputComponent = (
            <fs-component-render ref={"targetInputRef"} {...computedForm.value.component} {...ctx.attrs} />
          );
        }
        return (
          <div class={"fs-cell-edit"}>
            <div class={"fs-cell-edit-input"}>{inputComponent}</div>
            {editIcon}
          </div>
        );
      }

      let dirty = null;
      if (editable.isChanged && editable.isChanged()) {
        dirty = <div class={"fs-cell-edit-dirty"} />;
      }

      let activeTrigger = {};
      let actions = null;
      if (props.editable?.activeTrigger) {
        activeTrigger = {
          [props.editable?.activeTrigger]: () => {
            if (computedIsEditable.value) {
              props.editable.active();
            }
          }
        };
        actions = (
          <div class={"fs-cell-edit-action fs-cell-edit-icon"}>
            <fs-icon icon={ui.icons.edit} />
          </div>
        );
      }
      return (
        <div key={props.index} class={"fs-cell-edit"} {...activeTrigger}>
          <div class={"fs-cell-edit-input"}>
            {dirty}
            <fs-cell ref={"targetRef"} item={props.item} scope={props.scope} {...ctx.attrs} />
          </div>
          {actions}
        </div>
      );
    };
  },
  methods: {
    //@ts-ignore
    getTargetRef() {
      //@ts-ignore
      return this.$refs.targetRef?.getTargetRef();
    }
  }
});
