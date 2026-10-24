const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const source=fs.readFileSync(path.join(__dirname,'../desktop/plugin.js'),'utf8')
const jsx=(type,props,key)=>({type,props,key})
const ctx=vm.createContext({Intl,Date,jsx,jsxs:jsx,useMemo:fn=>fn()})
vm.runInContext(source.replace(/^import .*$/gm,'').replace('export default','globalThis.plugin ='),ctx)
const run=code=>vm.runInContext(code,ctx)
test('month grid is Monday-first and includes 42 dates',()=>{
 assert.equal(run("grid('2026-10-01').length"),42)
 assert.equal(run("grid('2026-10-01')[0]"),'2026-09-28')
 assert.equal(run("grid('2026-10-01')[41]"),'2026-11-08')
})
test('month navigation handles year boundary and leap year',()=>{
 assert.equal(run("move('2026-12-01',1)"),'2027-01-01')
 assert.equal(run("plus('2028-02-28',1)"),'2028-02-29')
})
test('lunar day and traditional holiday labels',()=>{
 assert.equal(run("lunarLabel('2026-10-24')"),'十五')
 assert.equal(run("lunarLabel('2026-10-18')"),'重阳节')
})
test('today uses rounded square and date click selects day',()=>{
 let selected
 ctx.select=d=>selected=d
 const cell=run("DayCell({day:'2026-10-24',month:'2026-10-01',today:'2026-10-24',selected:'2026-10-26',items:[],select})")
 assert.equal(cell.props.style.borderRadius,'8px')
 assert.equal(cell.props.style.aspectRatio,'1 / 1')
 assert.equal(cell.props['aria-current'],'date')
 assert.match(cell.props.style.border,/ui-accent/)
 cell.props.onClick();assert.equal(selected,'2026-10-24')
})
test('all-day end is exclusive; midnight does not spill into next day',()=>{
 assert.equal(run("onDay([{start:'2026-10-30',end:'2026-10-31',all_day:true}],'2026-10-31').length"),0)
 assert.equal(run("onDay([{start:'2026-10-30T23:00:00+08:00',end:'2026-10-31T00:00:00+08:00',all_day:false}],'2026-10-31').length"),0)
})
test('register native movable pane with no forced redocking',()=>{
 let pane;ctx.plugin.register({register:v=>pane=v})
 assert.equal(pane.area,'panes');assert.equal(pane.data.placement,'main')
 assert.equal(pane.data.dock.pos,'right');assert.notEqual(pane.data.dock.enforce,true)
})
