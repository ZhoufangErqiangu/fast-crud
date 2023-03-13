# use

## 初始化crud

### useFs
* 说明: 初始化crud
* 类型： `(props:UseFsProps):UseFsRet`
* 示例：

```js
//index.vue
export default {
    setup(){
        const customValue: any = {}; //自定义变量，传给createCrudOptions的额外参数（可以任意命名，任意多个）
        const { crudBinding, crudRef, crudExpose, resetCrudOptions, customExport } = useFs({ createCrudOptions, customValue });
        return {
            crudBinding,
            crudRef
        }
    }
}
   
```

### useFsAsync
* 说明: 异步初始化crud , 可以从后台获取配置后再初始化crud
* 类型： `(props:UseFsProps):Promise<UseFsRet>`
* demo： [antdv](http://fast-crud.docmirror.cn/antdv/#/crud/advanced/from-backend)  /  [element](http://fast-crud.docmirror.cn/element/#/crud/advanced/from-backend)  /  [naive](http://fast-crud.docmirror.cn/naive/#/crud/advanced/from-backend)
* 示例：

```js
//index.vue
export default {
    setup(){
        const crudBinding:Ref<CrudBinding> = ref()
        const crudRef:Ref = ref()
        const customValue: any = {}; //自定义变量，传给createCrudOptions的额外参数（可以任意命名，任意多个）
        onMounted(async ()=>{
            // 要求createCrudOptions也要是一个异步方法
            const {  crudExpose, customExport } = await useFs({crudBinding,crudRef, createCrudOptions, customValue } as UseFsProps);
        })
        return {
            crudBinding,
            crudRef
        }
    }
}
```

### createCrudOptions
* 说明: 创建CrudOptions的方法，需要用户实现，并传入useFs 或 useFsAsync
* 类型： `(props:CreateCrudOptionsProps):CreateCrudOptionsRet |  (props:CreateCrudOptionsProps):Promise<CreateCrudOptionsRet>`

### resetCrudOptions
* 说明: useFs返回值之一，可以重新设置crudOptions，重设后表格数据会被清空
* 类型： `(opts:CrudOptions)=>void`
* 示例：

```js
//index.vue
export default {
    setup(){
        const { crudBinding, crudRef, crudExpose, crudOptions, resetCrudOptions } = useFs({ createCrudOptions });

        // 此处演示如何合并crudOptions，
        // 合并后在原有配置基础上追加多一个字段
        // 然后进行重置（重置后，data数据会被清空，需要重新refresh）
        onMounted(()=>{
            resetCrudOptions(_.merge({},crudOptions,{
                columns:{
                    addField:{
                        title:"追加字段",
                        type:'text'
                    }
                }
            }))
            crudExpose.doRefresh()
        })
        
        return {
            crudBinding,
            crudRef
        }
    }
}
```


## form对话框

### useFormWrapper
* 说明: 获得打开自定义对话框能力，可以同时打开多个（默认的view/add/edit只能打开一个）
* 类型： `()=>{opts:OpenDialogProps}`
* 示例：
```js

import {useFormWrapper,useColumns,CrudOptions} from "@fast-crud/fast-crud";
import createCrudOptions from 'crud'

async function openCustomDialog(){
  const {openDialog} = useFormWrapper()
  const {buildFormOptions} = useColumns();
  const {crudOptions} = createCrudOptions({...} as CrudOptions);
  const opts = buildFormOptions(crudOptions); //将 crudOptions 转化为form表单所需要的options
  const wrapperRef = await openDialog(opts) //打开对话框
  //获取formData
  const formData = wrapperRef.getFormData();
  wrapperRef.setFormData({xxx:'value'});
  //对话框实例
  return wrapperRef
}
```
::: warning
使用此方式打开的对话框无法通过crudExpose.getFormWrapperRef、crudExpose.getFormData获取到实例Ref和data。你只能通过返回值获取
:::


