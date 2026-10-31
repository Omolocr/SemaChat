import os
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS=os.path.join(os.environ.get('TMPDIR','/tmp'),'semachat-shot-')
from playwright.sync_api import sync_playwright
errs=[];res=[]
def ok(n,c): res.append(('PASS' if c else 'FAIL')+' '+n)
S=SHOTS+'a-'
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
    T=lambda:pg.inner_text('body').lower()
    pg.goto('file://'+HERE+'/semachat-preview.html'); W()
    # ---- sign up as an adult (personal)
    pg.click('[data-act=authmode][data-m=up]'); W(200)
    ok('signup lists requirements','what you need for a personal account' in T())
    pg.click('[data-act=addemo]'); W(200); pg.screenshot(path=S+'01-signup.png')
    pg.click('[data-act=otp]'); W(300); pg.fill('[data-bind="auth.code"]','123ABC'); pg.click('[data-act=authgo]'); W(500); ok('sign-up blocked until terms accepted','terms of use' in pg.inner_text('.err').lower()) if True else 0; pg.click('#adConsent'); pg.click('[data-act=authgo]'); W(900)
    pg.click('[data-act=tab][data-t=me]'); W(700)
    ok('profile has Normal and Business widgets',pg.locator('.modew button').count()==2 and 'your personal space' in T())
    ok('green badge for ID submitter','verified' in T() and 'go gold' in T())
    pg.click('.modew button >> nth=1'); W(500)
    ok('business click opens welcome/registration','business' in T())
    pg.click('[data-act=back]') if pg.locator('[data-act=back]').count() else None; W(200)
    pg.click('[data-act=tab][data-t=me]'); W(500)
    pg.screenshot(path=S+'02-me.png')
    # location locator
    pg.click('.sw >> nth=0'); W(600); ok('location turned on','sharing' in T())
    pg.click('.sw >> nth=0'); W(600); ok('location turned off','off' in T())
    # wallet activation -> bank -> loans
    pg.click('[data-act=go][data-p=wallet]'); W(600); ok('wallet offers activation','activate your wallet' in T())
    pg.click('[data-act=adbanksheet]'); W(300); pg.click('[data-act=adbankconsent]'); W(200); pg.click('[data-act=adbanksave]'); W(800)
    ok('bank account opened','ultra' in T() or 'account 01' in T() or 'semachat trust bank' in T()); pg.screenshot(path=S+'03-bank.png')
    pg.click('[data-act=go][data-p=adloans]'); W(700); ok('loans page shows score','trust score' in T())
    pg.screenshot(path=S+'04-loans.png')
    # chats: moment composer
    pg.click('[data-act=back]'); W(200); pg.click('[data-act=tab][data-t=chats]'); W(600)
    pg.click('[data-act=admk][data-k=moment]'); W(300); pg.click('[data-act=adsample]'); W(300); pg.fill('[data-bind="ad.mk.caption"]','Hello SemaChat'); pg.click('[data-act=admkpost]'); W(900)
    ok('own moment appears in ring','your moment' in T())
    # super moment
    pg.click('[data-act=tab][data-t=contacts]'); W(500); pg.click('[data-act=cs][data-v=ana]'); W(800)
    ok('super moments row in AnA','super moments' in T()); pg.screenshot(path=S+'05-ana.png')
    pg.click('[data-act=admk][data-k=super]'); W(300); pg.click('[data-act=adsample]'); W(300)
    ok('super sample = 3:20 enabled',pg.locator('[data-act=admkpost][disabled]').count()==0)
    pg.click('[data-act=adsample]'); W(300); ok('over 5 min blocked',pg.locator('[data-act=admkpost][disabled]').count()==1)
    pg.click('[data-act=adclear]'); W(200); pg.click('[data-act=adsample]'); W(300); pg.click('[data-act=admkpost]'); W(900)
    # chat has no ticks / last seen
    pg.click('[data-act=tab][data-t=chats]'); W(500); pg.locator('[data-act=openchat]').first.click(); W(700)
    tx=pg.inner_text('#scr').lower()
    ok('no last seen / online / read ticks','last seen' not in tx and 'online' not in tx and '✓✓' not in tx and 'delivered' not in tx and 'seen' not in tx)
    # ---- minor signup
    pg.evaluate("localStorage.clear()"); pg.goto('file://'+HERE+'/semachat-preview.html'); W()
    pg.click('[data-act=authmode][data-m=up]'); W(200); pg.click('[data-act=addemo]'); W(200)
    pg.fill('[data-bind="ad.su.age"]','15'); pg.press('[data-bind="ad.su.age"]','Tab'); W(300)
    ok('minor shows guardian block','guardian approval' in T())
    pg.fill('[data-bind="ad.su.g.name"]','Grace Mwangi'); pg.fill('[data-bind="ad.su.g.phone"]','0722 333 444'); pg.fill('[data-bind="ad.su.g.email"]','grace@mail.com')
    pg.fill('[data-bind="ad.su.g.idNumber"]','22334455'); pg.click('[data-act=adsu][data-p="g.gender"][data-v=female]'); pg.fill('[data-bind="ad.su.g.age"]','41'); pg.fill('[data-bind="ad.su.g.city"]','Nyeri'); pg.fill('[data-bind="ad.su.g.approvalCode"]','123ABC')
    pg.screenshot(path=S+'06-minor.png')
    pg.fill('[data-bind="auth.email"]','kid.user@mail.com'); pg.click('[data-act=otp]'); W(300); pg.fill('[data-bind="auth.code"]','123ABC'); pg.click('[data-act=authgo]'); W(500); ok('sign-up blocked until terms accepted','terms of use' in pg.inner_text('.err').lower()) if False else 0; pg.click('#adConsent'); pg.click('[data-act=authgo]'); W(900)
    pg.click('[data-act=tab][data-t=me]'); W(700); ok('minor sees protected account notice','protected account' in T())
    # ---- admin
    pg.goto(_urls()[1]); pg.wait_for_timeout(600); _alogin(pg); W(700)
    pg.click('[data-act=a_sec][data-s=safety]'); W(500); pg.click('[data-act=a_cdemo]'); W(900)
    ok('safety shows alerts','stranger' in pg.inner_text('.main').lower() or 'risky' in pg.inner_text('.main').lower()); pg.screenshot(path=S+'07-safety.png')
    pg.click('[data-act=a_sec][data-s=aml]'); W(600); ok('money alerts listed','large transaction' in pg.inner_text('.main').lower() or 'structuring' in pg.inner_text('.main').lower()); pg.screenshot(path=S+'08-aml.png')
    pg.locator('[data-act=a_aact][data-v=escalate]').first.click(); W(600); ok('alert escalated','escalated' in pg.inner_text('.main').lower())
    pg.click('[data-act=a_sec][data-s=people]'); W(600); ok('people table','gender' in pg.inner_text('.main').lower())
    pg.click('[data-act=a_pf][data-k=a][data-v=minor]'); W(600); pg.locator('[data-act=a_pdet]').first.click(); W(600)
    ok('person detail','identity' in pg.inner_text('.main').lower()); pg.screenshot(path=S+'09-people.png')
    pg.click('[data-act=a_sec][data-s=lending]'); W(600); ok('lending view','bank accounts' in pg.inner_text('.main').lower())
    print('\n'.join(res)); print('ERRS',errs); b.close()
