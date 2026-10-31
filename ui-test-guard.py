import os
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(os.environ.get('TMPDIR','/tmp'),'semachat-shot-','shots'); os.makedirs(SH,exist_ok=True)
errs=[];res=[]
def ok(n,c): res.append(('PASS' if c else 'FAIL')+' '+n)
def _urls(_h=None):
    import os; HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return 'file://'+HERE+'/semachat-preview.html','file://'+HERE+'/semachat-console-preview.html'
def _alogin(p):
    p.click('[data-act=a_otp]'); p.wait_for_timeout(350); p.fill('[data-bind="adm.code"]','123abc'); p.click('[data-act=a_signin]')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':430,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept(d.default_value))
    W=lambda t=450:pg.wait_for_timeout(t); T=lambda:pg.inner_text('body').lower()
    pg.goto('file://'+HERE+'/semachat-preview.html'); W()
    pg.fill('[data-bind="auth.email"]','amani@mail.com'); pg.click('[data-act=otp]'); pg.fill('[data-bind="auth.code"]','123ABC'); pg.click('[data-act=authgo]'); W(800)
    # developer: Content guard
    pg.goto(_urls()[1]); pg.wait_for_timeout(600); _alogin(pg); W(800)
    pg.click('[data-act=a_sec][data-s=guard]'); W(700); M=lambda:pg.inner_text('.main').lower()
    ok('guard section lists starter terms and explains behaviour','content guard' in M() and 'marked “not delivered”' in M() and 'kill them all' in M())
    pg.fill('[data-bind="f.gTerm"]','SemaChat Banned Word'); pg.select_option('[data-bind="f.gType"]','slang'); pg.click('[data-act=a_guardadd]'); W(700)
    ok('developer adds a term','semachat banned word' in M())
    pg.fill('[data-bind="f.gTest"]','this has s3m@chat b@nned w0rd inside'); pg.click('[data-act=a_guardtest]'); W(500); ok('test box catches disguised spelling','would be stopped' in M())
    pg.fill('[data-bind="f.zName"]','Demo zone'); pg.fill('[data-bind="f.zLat"]','-1.2864'); pg.fill('[data-bind="f.zLng"]','36.8172'); pg.fill('[data-bind="f.zRad"]','500'); pg.click('[data-act=a_guardzone]'); W(700); ok('zone added','demo zone' in M())
    pg.screenshot(path=SH+'/g1-admin.png')
    # sender experience
    pg.goto(_urls()[0]); pg.wait_for_timeout(1100); pg.click('[data-act=tab][data-t=chats]'); W(500)
    pg.click('.li[data-act=openchat] >> nth=0'); W(500)
    pg.fill('#msgin','Habari, ok message'); pg.press('#msgin','Enter'); W(500); ok('normal message has no warning','not delivered' not in pg.inner_text('#scr').lower())
    pg.fill('#msgin','this is the semachat banned word'); pg.press('#msgin','Enter'); W(600)
    ok('sender sees the message with Not delivered','this is the semachat banned word' in pg.inner_text('#scr').lower() and 'not delivered' in pg.inner_text('#scr').lower())
    pg.screenshot(path=SH+'/g2-sender.png')
    pg.reload(); W(900); pg.click('[data-act=tab][data-t=chats]'); W(500); pg.click('.li[data-act=openchat] >> nth=0'); W(600)
    ok('still marked after reopening the chat','not delivered' in pg.inner_text('#scr').lower())
    b.close()
print('\n'.join(res)); print('ERRS',errs)
