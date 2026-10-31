def _alogin(p):
    p.click('[data-act=a_otp]'); p.wait_for_timeout(350); p.fill('[data-bind="adm.code"]','123abc'); p.click('[data-act=a_signin]')
# Two real browsers, a real server: a video call is set up over WebRTC through the SSE signalling.
import os,subprocess,tempfile,time,sys,urllib.request
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(HERE,'shots'); os.makedirs(SH,exist_ok=True)
PORT=4600+os.getpid()%300; res=[]; errs=[]
def ok(n,c): res.append(('PASS' if c else 'FAIL')+' '+n)
env=dict(os.environ,PORT=str(PORT),SEMACHAT_DB=os.path.join(tempfile.mkdtemp(),'u.json'))
srv=subprocess.Popen(['node',os.path.join(HERE,'backend','server.js')],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
try:
    for _ in range(40):
        try: urllib.request.urlopen('http://127.0.0.1:%d/healthz'%PORT); break
        except Exception: time.sleep(.25)
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        def user(phone,name):
            c=b.new_context(viewport={'width':430,'height':860},permissions=['microphone','camera']); pg=c.new_page()
            pg.on('pageerror',lambda e:errs.append(name+':'+str(e))); pg.goto('http://127.0.0.1:%d/'%PORT); pg.wait_for_timeout(500)
            pg.fill('[data-bind="auth.email"]',phone); pg.click('[data-act=otp]'); pg.fill('[data-bind="auth.code"]','123ABC'); pg.click('[data-act=authgo]'); pg.wait_for_timeout(1200); return pg
        A=user('amani@mail.com','amani'); B=user('wanjiru@mail.com','wanjiru')
        A.click('.nav [data-t=chats]'); A.wait_for_timeout(500)
        A.locator('.li[data-act=openchat]:has-text("Wanjiru")').first.click(); A.wait_for_timeout(500)
        A.click('[data-act=call][data-m=video]'); A.wait_for_timeout(800)
        ok('caller sees the call screen (ringing)','ringing' in A.inner_text('#rtc').lower())
        B.wait_for_selector('#rtcin',timeout=5000); ok('callee gets an incoming call prompt','amani' in B.inner_text('#rtcin').lower())
        B.click('[data-rt=accept]')
        for _ in range(40):
            sa=A.evaluate("(()=>{const r=window.__rtc();return r?Object.values(r.peers).map(p=>p.pc.connectionState):[]})()"); sb=B.evaluate("(()=>{const r=window.__rtc();return r?Object.values(r.peers).map(p=>p.pc.connectionState):[]})()")
            if sa==['connected'] and sb==['connected']: break
            A.wait_for_timeout(250)
        ok('WebRTC connected on both sides (%s / %s)'%(sa,sb),sa==['connected'] and sb==['connected'])
        A.wait_for_timeout(1500)
        w=lambda pg:pg.evaluate("(()=>{const v=document.querySelector('#rtc .tile:not(.me) video');return v?[v.videoWidth,v.readyState]:null})()")
        wa,wb=w(A),w(B)
        for _ in range(30):
            if wa and wb and wa[0]>0 and wb[0]>0: break
            A.wait_for_timeout(300); wa,wb=w(A),w(B)
        ok('remote video frames arrive both ways (%s / %s)'%(wa,wb),bool(wa and wb and wa[0]>0 and wb[0]>0))
        ok('timer running','ringing' not in A.inner_text('#rtc').lower())
        A.screenshot(path=SH+'/call-a.png'); B.screenshot(path=SH+'/call-b.png')
        B.click('[data-rt=mute]'); B.wait_for_timeout(200); ok('mute disables the mic track',B.evaluate("window.__rtc().local.getAudioTracks()[0].enabled===false"))
        A.click('[data-rt=end]'); A.wait_for_timeout(900)
        ok('caller screen closed',A.locator('#rtc').count()==0); ok('callee screen closed too',B.locator('#rtc').count()==0)
        A.wait_for_timeout(500); ok('call logged in the chat','call' in A.inner_text('#scr').lower())
        # second call: callee declines
        A.click('[data-act=call][data-m=voice]'); B.wait_for_selector('#rtcin',timeout=5000); B.click('[data-rt=decline]'); A.wait_for_timeout(1200)
        ok('decline ends the call for the caller',A.locator('#rtc').count()==0)
        ad=b.new_context(viewport={'width':1200,'height':800}).new_page(); ad.goto('http://127.0.0.1:%d/console'%PORT); ad.wait_for_timeout(800); _alogin(ad); ad.wait_for_timeout(900)
        ad.click('[data-act=a_sec][data-s=providers]'); ad.wait_for_timeout(700); t=ad.inner_text('.main').lower(); ok('admin providers: SMS + M-Pesa still demo, sessions unsigned','providers' in t and 'demo' in t and 'unsigned' in t and 'json file' in t); ad.screenshot(path=SH+'/e14-providers.png')
        b.close()
finally:
    srv.terminate()
print('\n'.join(res)); print('ERRS',errs)
