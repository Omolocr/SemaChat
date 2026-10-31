# Real server + real browser: research-team sign-in on both consoles, and the installable-app files.
import os,subprocess,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT=5500+os.getpid()%300; res=[]; errs=[]
def ok(n,c): res.append(('PASS' if c else 'FAIL')+' '+n)
env=dict(os.environ,PORT=str(PORT),SEMACHAT_DB=os.path.join(tempfile.mkdtemp(),'t.json'),SEMACHAT_TEAM_ACCESS='1',SEMACHAT_TEAM_EMAILS='tester@wavehub.co.ke',SEMACHAT_TEAM_CODE='RESEARCH2026X',SEMACHAT_TEAM_PASS='ENTRYPASS2026ABCDEF')
srv=subprocess.Popen(['node',os.path.join(HERE,'backend','server.js')],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
try:
    for _ in range(40):
        try: urllib.request.urlopen('http://127.0.0.1:%d/healthz'%PORT); break
        except Exception: time.sleep(.25)
    U='http://127.0.0.1:%d'%PORT
    with sync_playwright() as p:
        b=p.chromium.launch(); ctx=b.new_context(viewport={'width':430,'height':900}); pg=ctx.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e))); W=lambda t=500:pg.wait_for_timeout(t); T=lambda:pg.inner_text('body').lower()
        pg.goto(U+'/?nosplash'); W(900)
        pg.fill('[data-bind="auth.email"]','tester@wavehub.co.ke'); pg.click('[data-act=otp]'); W(500)
        ok('team address is told to use the team code, no email','team access code' in T())
        pg.fill('[data-bind="auth.code"]','research2026x'); pg.click('[data-act=authgo]'); W(1500)
        ok('team member signed in to the client app','habari' in T() or 'chats' in T())
        pg.reload(); W(1200); ok('still signed in after reload','chats' in T() and 'verification code' not in T())
        reg=pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)"); ok('service worker registered (app is installable)',reg)
        ok('client page links its install manifest',pg.evaluate("document.querySelector('link[rel=manifest]').href.endsWith('/manifest.webmanifest')"))
        c=ctx.new_page(); c.on('pageerror',lambda e:errs.append(str(e)))
        c.goto(U+'/console'); c.wait_for_timeout(900)
        ok('console page links its own manifest',c.evaluate("document.querySelector('link[rel=manifest]').href.endsWith('/console.webmanifest')"))
        c.fill('[data-bind="adm.email"]','tester@wavehub.co.ke'); c.click('[data-act=a_otp]'); c.wait_for_timeout(500)
        ok('console says team code, no email','team access code' in c.inner_text('body').lower())
        c.fill('[data-bind="adm.code"]','RESEARCH2026X'); c.click('[data-act=a_signin]'); c.wait_for_timeout(1200)
        ok('team member signed in to the developer console','overview' in c.inner_text('body').lower())
        c.reload(); c.wait_for_timeout(1000); ok('console still signed in after reload','overview' in c.inner_text('body').lower())
        i=ctx.new_page(); i.goto(U+'/install'); i.wait_for_timeout(500); t=i.inner_text('body').lower()
        ok('install page lists phone, tablet and desktop steps','android' in t and 'iphone' in t and 'windows' in t and 'developer console' in t)
        # one private link: no sign-up, no sign-in, both consoles
        ctx2=b.new_context(viewport={'width':430,'height':900}); t=ctx2.new_page(); t.on('pageerror',lambda e:errs.append(str(e)))
        t.goto(U+'/team'); t.wait_for_timeout(700); ok('team page without a pass asks for the private link','private team link' in t.inner_text('body').lower())
        t.goto(U+'/team#pass=entrypass2026-abcdef&who=Amina'); t.wait_for_timeout(1500); tb=t.inner_text('body').lower()
        ok('team pass lets them in and offers both consoles','you are in' in tb and 'open the client app' in tb and 'open the developer console' in tb)
        ok('pass removed from the address bar','pass=' not in t.url)
        t.goto(U+'/?nosplash'); t.wait_for_timeout(1500); ok('client app opens signed in, no code asked','chats' in t.inner_text('body').lower() and 'verification code' not in t.inner_text('body').lower())
        t.goto(U+'/console'); t.wait_for_timeout(1500); ok('developer console opens signed in, no code asked','overview' in t.inner_text('body').lower() and 'developer email' not in t.inner_text('body').lower())
        t.goto(U+'/team#pass=wrongwrongwrong1234'); t.wait_for_timeout(900); ok('wrong pass is refused','not valid' in t.inner_text('body').lower())
        b.close()
finally:
    srv.terminate()
print('\n'.join(res)); print('ERRS',errs)
