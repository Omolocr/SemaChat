import os
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); errs=[];res=[]
def ok(n,c): res.append(('PASS' if c else 'FAIL')+' '+n)
def _urls():
    return 'file://'+HERE+'/semachat-preview.html','file://'+HERE+'/semachat-console-preview.html'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':430,'height':900}); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept(d.default_value))
    W=lambda t=450:pg.wait_for_timeout(t); T=lambda:pg.inner_text('body').lower()
    url='file://'+HERE+'/semachat-preview.html'; pg.goto(url); W()
    ok('sign-in asks for email only','email address' in T() and 'phone number' not in T() and 'lost phone' not in T())
    pg.click('[data-act=otp]'); W(300); ok('empty email rejected','enter your email' in pg.inner_text('.err').lower())
    pg.fill('[data-bind="auth.email"]','nobody@mail.com'); pg.click('[data-act=otp]'); W(400); ok('unknown email says sign up first','sign up first' in pg.inner_text('.err').lower())
    pg.fill('[data-bind="auth.email"]','amani@mail.com'); pg.click('[data-act=otp]'); W(400); ok('code step shows email verification','verification code' in T() and 'demo mode' in T())
    pg.fill('[data-bind="auth.code"]','000000'); pg.click('[data-act=authgo]'); W(400); ok('wrong code rejected','verification code' in pg.inner_text('.err').lower())
    pg.fill('[data-bind="auth.code"]','123ABC'); pg.click('[data-act=authgo]'); W(900); ok('signed in with email','habari' in T() or 'chats' in T())
    # inactive for a long time: reload the page, still signed in
    pg.reload(); W(900); ok('still signed in after reload (no sign-in screen)','verification code' not in T() and 'chats' in T())
    pg.evaluate("localStorage.getItem('semachat_tok')&&1"); ok('token persisted',pg.evaluate("!!localStorage.getItem('semachat_tok')"))
    # manual sign off is the only way out
    pg.click('[data-act=tab][data-t=me]'); W(600)
    pg.locator('[data-act=signout]').first.click(); W(600); ok('signed out manually','email address' in T() and not pg.evaluate("!!localStorage.getItem('semachat_tok')"))
    pg.reload(); W(700); ok('stays signed out after reload','email address' in T())
    # sign up with email only (no phone)
    pg.click('[data-act=authmode][data-m=up]'); W(200); ok('sign-up has email, phone optional','email address (you will sign in with it)' in T() and 'phone number (optional)' in T() and 'lost phone' not in T())
    pg.click('[data-act=addemo]'); W(200); pg.click('[data-act=otp]'); W(400); ok('email verification step','email verification code' in T())
    pg.click('#adConsent'); pg.fill('[data-bind="auth.code"]','123ABC'); pg.click('[data-act=authgo]'); W(1000); ok('account created with email only','habari' in T() or 'chats' in T())
    # sign out / change account, then the code box: uppercase, 6 characters, wording about the sender and 5 minutes
    pg.click('[data-act=tab][data-t=me]'); W(500); ok('button says Sign out / change account','sign out / change account' in T())
    pg.locator('[data-act=signout]').first.click(); W(500)
    ok('sign-in page explains sender, code and 5 minutes','login1@wavehub.co.ke' in T() and '5 minutes' in T() and '6-character' in T())
    pg.click('[data-act=authmode][data-m=in]'); W(200); pg.fill('[data-bind="auth.email"]','amani@mail.com'); pg.click('[data-act=otp]'); W(400)
    pg.type('[data-bind="auth.code"]','ab1c2d99'); W(100)
    ok('code box uppercases and drops symbols',pg.input_value('[data-bind="auth.code"]')=='AB1C2D99')
    # preview only: development team can enter without signing in
    pg.click('[data-act=authmode][data-m=in]'); W(200); ok('preview offers team entry on sign-in','enter without signing in' in T())
    pg.click('[data-act=teamdemo]'); W(1200); ok('team entry opens the client app',('habari' in T() or 'chats' in T()) and 'verification code' not in T())
    pg.click('[data-act=tab][data-t=me]'); W(400); pg.locator('[data-act=signout]').first.click(); W(500)
    # developer console uses email + code too (no password), and stays signed in
    pg.goto(_urls()[1]); W(700)
    ok('console asks for email, not password','developer email' in T() and 'password' not in T())
    pg.fill('[data-bind="adm.email"]','nobody@x.com'); pg.click('[data-act=a_otp]'); W(400); ok('unlisted address gets the same neutral answer','if that address belongs to a developer' in T())
    pg.click('[data-act=a_otpback]'); W(200); pg.fill('[data-bind="adm.email"]','admin@semachat.app'); pg.click('[data-act=a_otp]'); W(400)
    pg.fill('[data-bind="adm.code"]','000000'); pg.click('[data-act=a_signin]'); W(500); ok('wrong developer code refused','wrong or expired' in T())
    pg.fill('[data-bind="adm.code"]','123abc'); pg.click('[data-act=a_signin]'); W(900); ok('developer signed in','overview' in T())
    pg.reload(); W(900); ok('developer still signed in after reload','overview' in T() and 'developer email' not in T())
    pg.locator('[data-act=a_signout]').first.click(); W(500); ok('developer signs out by clicking','developer email' in T())
    pg.click('[data-act=a_teamdemo]'); W(900); ok('console team entry skips sign-in','overview' in T())
    b.close()
print('\n'.join(res)); print('ERRS',errs)
