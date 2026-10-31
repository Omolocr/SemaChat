import os
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS=os.path.join(os.environ.get('TMPDIR','/tmp'),'semachat-shot-')
from playwright.sync_api import sync_playwright
errs=[];res=[]
def ok(n,c): res.append(('PASS' if c else 'FAIL')+' '+n)
S=SHOTS+'bo-'
def _urls(_h=None):
    import os; HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return 'file://'+HERE+'/semachat-preview.html','file://'+HERE+'/semachat-console-preview.html'
def _alogin(p):
    p.click('[data-act=a_otp]'); p.wait_for_timeout(350); p.fill('[data-bind="adm.code"]','123abc'); p.click('[data-act=a_signin]')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':430,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append('console:'+m.text) if m.type=='error' else None)
    pg.on('dialog',lambda d:d.accept(d.default_value))
    W=lambda t=450:pg.wait_for_timeout(t)
    T=lambda:pg.inner_text('#scr').lower()
    pg.goto('file://'+HERE+'/semachat-preview.html'); W()
    pg.fill('[data-bind="auth.email"]','hello@savannacoffee.example'); pg.click('[data-act=otp]'); pg.fill('[data-bind="auth.code"]','123ABC'); pg.click('[data-act=authgo]'); W(700)
    pg.click('[data-act=msw][data-v=business]'); W(700)
    ok('business home has grow tiles','grow your business' in T())
    pg.click('[data-act=go][data-p=bcat]'); W(600); ok('catalog lists items','add' in T() and 'sold' in T()); pg.screenshot(path=S+'1-cat.png')
    n0=pg.locator('.exc').count()
    pg.click('[data-act=bxitem]'); W(300)
    pg.fill('[data-bind="bx.f.name"]','Test Mug'); pg.fill('[data-bind="bx.f.price"]','900'); pg.click('[data-act=bxsaveitem]'); W(700)
    ok('item added',pg.locator('.exc').count()==n0+1)
    pg.click('[data-act=back]'); W(300)
    pg.click('[data-act=go][data-p=bpage]'); W(700); ok('page editor + reviews','reviews' in T()); pg.screenshot(path=S+'2-page.png')
    pg.click('[data-act=back]'); W(300)
    pg.click('[data-act=go][data-p=bstats]'); W(700)
    pg.click('[data-act=bxhist]') if pg.locator('[data-act=bxhist]').count() else None; W(800)
    ok('analytics shows funnel','funnel' in T()); pg.screenshot(path=S+'3-stats.png')
    pg.click('[data-act=back]'); W(300)
    pg.click('[data-act=go][data-p=bads]'); W(700)
    pg.click('[data-act=bxad]'); W(300)
    pg.fill('[data-bind="bx.af.name"]','Launch'); pg.fill('[data-bind="bx.af.headline"]','Fresh beans'); pg.click('[data-act=bxsavead]'); W(800)
    ok('ad submitted for review','in review' in T()); pg.screenshot(path=S+'4-ads.png')
    # admin approves
    pg.goto(_urls()[1]); pg.wait_for_timeout(600); _alogin(pg); W(600); pg.click('[data-act=a_sec][data-s=ads]'); W(600)
    pg.locator('[data-act=a_adact][data-v=approve]').first.click(); W(700)
    ok('ad approved by admin','live' in pg.inner_text('.main').lower())
    print('\n'.join(res)); print('ERRS',errs); b.close()
