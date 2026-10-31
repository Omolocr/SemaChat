// Builds semachat-preview.html: one self-contained file (frontend + backend as an in-browser mock API)
const fs=require('fs'),path=require('path');
const rd=(...p)=>fs.readFileSync(path.join(__dirname,...p),'utf8');
const html=rd('frontend','index.html');
const out=html.replace('<!--CORE-->',()=>'<script>\n'+rd('backend','core.js')+'\n'+rd('backend','business.js')+'\n'+rd('backend','compliance.js')+'\n'+rd('backend','health.js')+'\n'+rd('backend','music.js')+'\n'+rd('backend','community.js')+'\n'+rd('backend','realtime.js')+'\n'+rd('backend','guard.js')+'\n</script>').replace('<!--BIZ-->',()=>'<script>\n'+rd('frontend','business-ui.js')+'\n</script>').replace('<!--EXT-->',()=>['health-ui.js','music-ui.js','community-ui.js','calls-ui.js','ops-ui.js','guard-ui.js'].map(f=>'<script>\n'+rd('frontend',f)+'\n</script>').join('\n')).replace('<!--ADJ-->',()=>'<script>\n'+rd('frontend','adjust-ui.js')+'\n</script>');
const A=require('./backend/assets');
for(const [app,name] of [['client','semachat-preview.html'],['console','semachat-console-preview.html']]){
  fs.writeFileSync(path.join(__dirname,name),A.fill(out,'inline',app));
  console.log(name+' written',(fs.statSync(path.join(__dirname,name)).size/1024).toFixed(0)+' KB');
}
