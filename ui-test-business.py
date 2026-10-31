import os
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS=os.path.join(os.environ.get('TMPDIR','/tmp'),'semachat-shot-')
from playwright.sync_api import sync_playwright
errs=[];res=[]
def ok(n,c): res.append(('PASS' if c else 'FAIL')+' '+n)
S=SHOTS+'b-'
def _urls(_h=None):
    import os; HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return 'file://'+HERE+'/semachat-preview.html','file://'+HERE+'/semachat-console-preview.html'
def _alogin(p):
    p.click('[data-act=a_otp]'); p.wait_for_timeout(350); p.fill('[data-bind="adm.code"]','123abc'); p.click('[data-act=a_signin]')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':430,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append('console:'+m.text) if m.type=='error' else None)
    pg.on('dialog',lambda d:d.accept(d.default_value))
    W=lambda t=400:pg.wait_for_timeout(t)
    pg.goto('file://'+HERE+'/semachat-preview.html'); W()
    pg.fill('[data-bind="auth.email"]','amani@mail.com'); pg.click('[data-act=otp]'); pg.fill('[data-bind="auth.code"]','123ABC'); pg.click('[data-act=authgo]'); W(600)
    pg.click('[data-act=tab][data-t=explore]'); W(600)
    ok('explore lists businesses','businesses on semachat' in pg.inner_text('#scr').lower())
    pg.screenshot(path=S+'01-explore.png')
    pg.locator('[data-act=bxopen],[data-act=bxadopen]').first.click(); W(600)
    ok('business page opens','catalog' in pg.inner_text('#scr').lower())
    pg.locator('[data-act=bxqty]').first.click(); W(300)
    ok('basket bar shows','View basket' in pg.inner_text('#scr'))
    pg.click('[data-act=bxbasket]'); W(300); pg.screenshot(path=S+'02-basket.png')
    pg.click('[data-act=bxpay]'); W(700)
    pg.screenshot(path=S+'03-paid.png')
    ok('order placed toast/state','Order #' in pg.inner_text('body') or pg.locator('.bxbar').count()==0)
    pg.click('[data-act=back]'); W(300)
    pg.click('[data-act=tab][data-t=me]'); W(500)
    pg.locator('[data-act=go][data-p=myorders]').click(); W(600)
    ok('my orders lists the order','waiting for business' in pg.inner_text('#scr').lower())
    pg.screenshot(path=S+'04-myorders.png')
    # owner: switch to business mode via demo owner (Fatuma has savanna) -> use admin-less simulate
    pg.click('[data-act=back]'); W(200)
    pg.goto(_urls()[1]); pg.wait_for_timeout(600); _alogin(pg); W(600)
    pg.click('[data-act=a_sec][data-s=ads]'); W(600)
    ok('admin ad review renders','ad review' in pg.inner_text('.main').lower())
    pg.click('[data-act=a_sec][data-s=disputes]'); W(600)
    ok('admin disputes renders','disputes' in pg.inner_text('.main').lower())
    pg.screenshot(path=S+'05-admin.png')
    pg.goto('file://'+HERE+'/semachat-preview.html'); W(500)
    print('\n'.join(res)); print('ERRS',errs)
    b.close()
