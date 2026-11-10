window.__ModuleLoader__.load({
  id: 'dsh-devrel-toolkit-ui',
  factory: (require) => {
    const R = require('react'), h = R.createElement
    const PANEL = 'devrel-board'
    const labels = {
      support_request: '使用求助', suspected_bug: '疑似缺陷', feature_request: '功能请求',
      documentation_feedback: '文档反馈', design_discussion: '设计讨论', unknown: '待确认',
      environment: '环境', server_network: '服务 / 网络', authentication: '认证', configuration: '配置',
      plugin_composition: '插件组合', runtime: '运行时', design: '设计', other: '其他',
      queued: '等待分析', running: '分析中', done: '已分析', failed: '需处理',
    }
    const css = `
.dv{height:100%;overflow:auto;background:#f6f8f9;color:#182724;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box;padding:36px 40px}.dv *{box-sizing:border-box}.dv button,.dv input,.dv select{font:inherit}.dv button{cursor:pointer}.dv button:focus-visible,.dv a:focus-visible{outline:3px solid #4c9f86;outline-offset:3px}.dv-head{display:flex;justify-content:space-between;align-items:center;gap:20px}.dv-eyebrow{font-size:11px;letter-spacing:.16em;color:#588074;font-weight:700}.dv h1{font-size:28px;letter-spacing:-.04em;margin:6px 0}.dv-muted{color:#6c7d77;font-size:13px}.dv-btn{border:1px solid #d6e1dc;border-radius:9px;background:white;color:#254c3d;padding:8px 14px}.dv-btn:disabled{opacity:.5;cursor:default}.dv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:26px 0}.dv-stat{background:white;border:1px solid #e0e7e3;border-radius:12px;padding:16px 20px}.dv-stat strong{display:block;font-size:26px;font-weight:600}.dv-stat span{font-size:12px;color:#71847a}.dv-toolbar{display:flex;gap:10px;margin-bottom:16px}.dv-toolbar input{flex:1;min-width:0}.dv-toolbar input,.dv-toolbar select{background:white;border:1px solid #dce5df;border-radius:8px;padding:9px 12px;color:#253b31}.dv-layout{display:grid;grid-template-columns:minmax(250px,340px) minmax(300px,1fr);gap:20px;align-items:start}.dv-list{display:grid;gap:10px}.dv-row{width:100%;text-align:left;border:1px solid #dce5df;border-radius:10px;background:white;padding:16px;color:inherit}.dv-row.active{border-color:#39846b;box-shadow:0 0 0 1px #39846b}.dv-row b{display:block;font-weight:600;line-height:1.5;margin:8px 0}.dv-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;color:#7d8c85}.dv-tag{font-size:11px;background:#edf4ef;color:#3e7057;border-radius:5px;padding:2px 6px;display:inline-block}.dv-tag.failed{background:#fff0eb;color:#a05237}.dv-tag.running{background:#edf2ff;color:#526ab0}.dv-detail{background:white;border:1px solid #e0e7e3;border-radius:14px;padding:26px;min-height:410px}.dv-detail h2{font-size:20px;line-height:1.5;letter-spacing:-.02em;margin:12px 0 10px}.dv-detail a{color:#2a765c;text-decoration:none}.dv-section{padding:17px 0;border-top:1px solid #edf0ed}.dv-section h3{font-size:11px;letter-spacing:.08em;color:#7d8b83;margin:0 0 7px}.dv-section p{margin:0;white-space:pre-wrap}.dv-chips{display:flex;gap:6px;flex-wrap:wrap}.dv-empty{padding:50px 25px;text-align:center;color:#809087;background:white;border:1px dashed #d3ded6;border-radius:12px}.dv-notice{padding:12px 16px;background:#fff4e9;color:#8c5630;border-radius:8px;margin-bottom:15px}.dv-body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;color:#66796d;max-height:220px;overflow:auto}.dv footer{margin:24px 0 0;font-size:11px;color:#8a978f}@media(max-width:850px){.dv{padding:22px}.dv-layout{grid-template-columns:1fr}.dv-stats{gap:7px}.dv-stat{padding:10px}.dv-stat strong{font-size:22px}}
`
    function Icon({size=20}) {
      return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,'aria-hidden':true},
        h('rect',{x:3,y:3,width:7,height:7,rx:1.5}),h('rect',{x:14,y:3,width:7,height:7,rx:1.5}),
        h('rect',{x:3,y:14,width:7,height:7,rx:1.5}),h('rect',{x:14,y:14,width:7,height:7,rx:1.5}))
    }
    function Board({api}) {
      const [snapshot,setSnapshot]=R.useState(null),[detail,setDetail]=R.useState(null),[selected,setSelected]=R.useState(null)
      const [filter,setFilter]=R.useState('all'),[query,setQuery]=R.useState(''),[error,setError]=R.useState(''),[busy,setBusy]=R.useState(false)
      const detailRef=R.useRef(null)
      const load=R.useCallback(async(signal)=>{
        const next=await api('list',{},signal)
        if(signal?.aborted)return
        setSnapshot(next);setError('')
        const id=selected??next.records[0]?.id
        if(!selected&&id)setSelected(id)
        const row=next.records.find(r=>r.id===id)
        if(row&&(!detailRef.current||detailRef.current.id!==id||detailRef.current.updatedAt!==row.updatedAt)){
          const item=await api('get',{id},signal)
          if(signal?.aborted)return
          detailRef.current=item;setDetail(item)
        }
      },[api,selected])
      R.useEffect(()=>{
        const controller=new AbortController()
        let running=false
        const poll=async()=>{if(running)return;running=true;try{await load(controller.signal)}catch(e){if(!controller.signal.aborted)setError(e.message)}finally{running=false}}
        poll();const timer=setInterval(poll,2500)
        return()=>{clearInterval(timer);controller.abort()}
      },[load])
      const refresh=async()=>{try{await load()}catch(e){setError(e.message)}}
      const retry=async()=>{setBusy(true);try{await api('retry',{id:detail.id});await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
      const rows=(snapshot?.records??[]).filter(r=>(filter==='all'||r.status===filter)&&(`${r.issue.title} ${r.issue.repository}`.toLowerCase().includes(query.toLowerCase())))
      const tag=(text,cls='')=>h('span',{className:'dv-tag '+cls},text)
      const section=(label,body)=>h('section',{className:'dv-section'},h('h3',null,label),body)
      const a=detail?.analysis
      return h('div',{className:'dv'},h('style',null,css),
        h('header',{className:'dv-head'},h('div',null,h('div',{className:'dv-eyebrow'},'DEVREL / ISSUE INBOX'),h('h1',null,'DevRel 看板'),h('div',{className:'dv-muted'},'新反馈自动归档，分析结果集中查看。')),
          h('button',{className:'dv-btn',onClick:refresh},'刷新')),
        h('div',{className:'dv-stats'},...['queued','running','done','failed'].map(s=>h('div',{className:'dv-stat',key:s},h('strong',null,snapshot?.counts[s]??'—'),h('span',null,labels[s])))),
        error&&h('div',{role:'alert',className:'dv-notice'},error),
        h('div',{className:'dv-toolbar'},h('input',{placeholder:'搜索反馈标题或仓库',value:query,onChange:e=>setQuery(e.target.value),'aria-label':'搜索反馈'}),h('select',{value:filter,onChange:e=>setFilter(e.target.value),'aria-label':'筛选状态'},h('option',{value:'all'},'全部状态'),...['queued','running','done','failed'].map(s=>h('option',{value:s,key:s},labels[s])))),
        h('div',{className:'dv-layout'},h('div',{className:'dv-list'},rows.length?rows.map(r=>h('button',{key:r.id,className:'dv-row'+(selected===r.id?' active':''),onClick:()=>setSelected(r.id)},
          h('div',{className:'dv-meta'},tag(r.issue.isDemo?'本地演示':`#${r.issue.number}`),tag(labels[r.status],r.status)),h('b',null,r.issue.title.replace('[LOCAL TEST] ','')),
          h('div',{className:'dv-muted'},r.analysis?.summary??(r.status==='failed'?'分析失败，可在详情中重试':'等待后台分析…')),
          h('div',{className:'dv-meta',style:{marginTop:12}},h('span',null,r.issue.repository),h('span',null,new Date(r.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})))))
          :h('div',{className:'dv-empty'},snapshot?'还没有符合条件的反馈。新 Issue 到达后会自动出现在这里。':'正在连接看板…')),
          detail?h('article',{className:'dv-detail'},h('div',{className:'dv-chips'},tag(detail.issue.isDemo?'演示数据':'GitHub Issue'),tag(labels[detail.status],detail.status)),
            h('h2',null,detail.issue.title.replace('[LOCAL TEST] ','')),h('div',{className:'dv-muted'},detail.issue.repository,
              detail.issue.url&&h('a',{href:detail.issue.url,target:'_blank',rel:'noreferrer',style:{marginLeft:12}},'查看原 Issue ↗')),
            detail.status==='failed'&&section('需要处理',h('div',null,h('p',null,detail.error),h('button',{className:'dv-btn',style:{marginTop:12},disabled:busy,onClick:retry},busy?'正在提交…':'重新分析'))),
            a&&h(R.Fragment,null,
              section('分类',h('div',{className:'dv-chips'},tag(labels[a.intent]??a.intent),...a.areas.map(x=>h('span',{key:x,className:'dv-tag'},labels[x]??x)))),
              section('判断',h('p',null,a.summary)),section('下一步',h('p',null,a.nextAction)),
              a.missingInformation.length>0&&section('需补充',h('p',null,a.missingInformation.join('；'))),
              section('产品信号',h('p',null,a.productSignal)),section('解法状态',h('p',null,'未检索 · 尚未核实'))),
            !a&&detail.status!=='failed'&&section('分析进度',h('p',null,detail.status==='running'?'正在分析这条反馈…':'已保存，等待分析。')),
            section('原始反馈',h('div',null,h('p',{className:'dv-body'},detail.issue.body||'（无正文）'),detail.issue.bodyTruncated&&h('small',null,'正文已截取前 6,000 字符。'))),
            h('footer',null,detail.elapsedMs!=null?`${(detail.elapsedMs/1000).toFixed(1)} 秒 · ${detail.attempts} 次尝试 · `:'', '只读分析，不会自动评论或关闭 Issue。'))
          :h('div',{className:'dv-empty'},'选择一条反馈查看分析结果。')),
        h('footer',null,'监控仓库：',(snapshot?.repositories??[]).join('、')||'尚未配置仓库', ' · 数据保存在本机 · 自动更新'))
    }
    return {inject:['slots','layout','connection'],apply(ctx){
      const api=async(method,args={},signal)=>{
        const r=await ctx.connection.rpc.call('/api',`devrelBoard/${method}`,{args},signal)
        if(!r.ok)throw new Error(r.error?.message??'看板连接失败')
        return r.value
      }
      ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:PANEL,inject:()=>({api})},Board))
      ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:PANEL,order:15,label:()=> 'DevRel 看板'},Icon))
    }}
  }
})
