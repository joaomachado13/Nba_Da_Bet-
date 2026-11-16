# Optional browser regression checks: Python Playwright + system Chromium.
# Run a local HTTP server first, then: python3 tests/ux.browser.py
# All Supabase traffic is intercepted; fixture credentials never reach production.
import asyncio,base64,json,os,re,time
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright, expect
from datetime import datetime, timezone
OUT=Path(os.environ.get('NBA_UX_OUTPUT', '/tmp/nba-ux-check')); OUT.mkdir(parents=True, exist_ok=True)
UID='11111111-1111-4111-8111-111111111111'
USER={'id':UID,'aud':'authenticated','role':'authenticated','email':'jogador@example.invalid','is_anonymous':False,'user_metadata':{'display_name':'Jogador de teste','room_login_v2':True}}
def b64(o):return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
TOKEN=b64({'alg':'HS256','typ':'JWT'})+'.'+b64({'sub':UID,'exp':1999999999,'aud':'authenticated','role':'authenticated'})+'.fixture'
SESSION={'access_token':TOKEN,'refresh_token':'fixture-only','expires_at':1999999999,'expires_in':3600,'token_type':'bearer','user':USER}
GAMES=[{'id':str(i),'round_date':'2026-11-16','start_at':f'2026-11-16T{hour}:00:00Z','status':'scheduled','away_team_code':a,'away_team_name':an,'home_team_code':h,'home_team_name':hn,'away_record':'8-3','home_record':'7-4','away_score':None,'home_score':None} for i,hour,a,an,h,hn in [(1,23,'BOS','Celtics','LAL','Lakers'),(2,23,'GSW','Warriors','DEN','Nuggets')]]
PROFILES=[{'id':UID,'display_name':'Jogador de teste'},{'id':'22222222-2222-4222-8222-222222222222','display_name':'Outro jogador'}]
async def main():
    async with async_playwright() as p:
        proxy=os.environ.get('HTTPS_PROXY')
        options={'server':proxy,'bypass':'127.0.0.1,localhost'} if proxy else None
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,proxy=options)
        context=await browser.new_context(service_workers='block',viewport={'width':1440,'height':1000})
        calls=[];writes=[];errors=[];predictions=[]
        mode={'fail':False,'delay':.18,'empty':False,'get_error':False}
        async def api(route):
            req=route.request;u=urlparse(req.url);q=parse_qs(u.query);table=u.path.split('/')[-1]
            calls.append((req.method,table))
            await asyncio.sleep(mode['delay'])
            if req.method not in ('GET','HEAD','OPTIONS'):
                writes.append((table,req.post_data))
                if mode['fail']:
                    await route.fulfill(status=503,json={'message':'Simulated failure'});return
                if table=='predictions':
                    pick=json.loads(req.post_data);predictions[:]=[x for x in predictions if x['game_id']!=pick['game_id']];predictions.append(pick)
                await route.fulfill(status=200,json=[]);return
            if mode['get_error'] and table=='games':
                await route.fulfill(status=503,json={'message':'Simulated unavailable games'});return
            if table=='user':data=USER
            elif table=='profiles':data=PROFILES[:1] if 'id' in q else PROFILES
            elif table=='games':data=[] if mode['empty'] or q.get('round_date')==['eq.2026-11-17'] else GAMES
            elif table=='standings':data=[{'user_id':UID,'display_name':'Jogador de teste','points':8,'decided_picks':10,'total_picks':12},{'user_id':PROFILES[1]['id'],'display_name':'Outro jogador','points':7,'decided_picks':10,'total_picks':11}]
            elif table=='predictions':data=predictions
            else:data=[]
            if 'application/vnd.pgrst.object+json' in req.headers.get('accept',''):data=data[0] if data else None
            await route.fulfill(status=200,json=data,headers={'Content-Range':'0-1/2'})
        await context.route('https://*.supabase.co/**',api)
        async def new_page(path):
            page=await context.new_page()
            await page.clock.set_fixed_time(datetime(2026,11,16,12,tzinfo=timezone.utc))
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto('http://127.0.0.1:8000/'+path,wait_until='domcontentloaded')
            return page
        login=await new_page('login.html')
        await login.locator('#playerEmail').fill('jogador@example.invalid')
        await login.locator('#roomCode').fill('0000')
        await login.locator('#toggleRoomCode').click()
        await expect(login.locator('#roomCode')).to_have_attribute('type','text')
        await login.locator('button[type=submit]').click()
        await expect(login.locator('#roomCode')).to_have_attribute('aria-invalid','true')
        await expect(login.locator('#roomCodeError')).to_be_visible()
        await login.locator('#roomCode').fill('0001')
        await expect(login.locator('#roomCodeError')).to_be_empty()
        await login.screenshot(path=str(OUT/'login-desktop.png'),full_page=True)
        await login.set_viewport_size({'width':390,'height':844})
        await login.screenshot(path=str(OUT/'login-mobile.png'),full_page=True)
        assert not writes
        print('PASS: show/hide code, inline error, correction; no login or recovery sent')
        await context.add_init_script('localStorage.setItem("sb-wueaswmbujgitfxydphh-auth-token",'+json.dumps(json.dumps(SESSION))+');')
        page=await new_page('index.html')
        await expect(page.locator('#gamesList')).to_have_attribute('aria-busy','true')
        await expect(page.locator('.round-card')).to_have_attribute('aria-busy','true')
        await expect(page.locator('.season-glance')).to_have_attribute('aria-busy','true')
        await expect(page.locator('.loading-card').first).to_be_visible()
        assert await page.locator('.skeleton-line').first.evaluate('(el) => el.getAnimations({subtree:true}).length > 0')
        await expect(page.locator('.pick-button')).to_have_count(4)
        await page.wait_for_load_state('networkidle')
        await expect(page.locator('.is-loading')).to_have_count(0)
        await expect(page.locator('.skeleton-line')).to_have_count(0)
        await page.screenshot(path=str(OUT/'home-desktop.png'),full_page=True)
        button=page.locator('[data-game-id="1"] [data-pick="BOS"]')
        await button.focus();await button.press('Enter')
        await expect(page.locator('[data-game-id="1"]')).to_have_attribute('aria-busy','true')
        await expect(page.locator('#roundFinalizeButton')).to_be_disabled()
        # Repeated events during the same in-flight save must not issue another write.
        await button.dispatch_event('click');await button.dispatch_event('click')
        await expect(page.locator('[data-game-id="1"]')).to_have_attribute('aria-busy','false')
        assert len([w for w in writes if w[0]=='predictions'])==1
        await expect(button).to_be_focused();await expect(button).to_have_attribute('aria-pressed','true')
        await expect(page.locator('#picksDone')).to_have_text('1')
        assert '<span' not in await page.locator('[data-game-id="1"] .pick-saved').inner_text()
        print('PASS: one save under repeated clicks; focus retained; confirmed progress only')
        mode['fail']=True
        other=page.locator('[data-game-id="1"] [data-pick="LAL"]')
        await other.click()
        await expect(page.locator('[data-game-id="1"]')).to_have_class(re.compile('save-failed'))
        await expect(button).to_have_attribute('aria-pressed','true')
        await expect(page.locator('[data-game-id="1"] .pick-saved')).to_contain_text('Não foi salvo')
        await page.screenshot(path=str(OUT/'save-error.png'),full_page=True)
        mode['fail']=False
        await other.click()
        await expect(other).to_have_attribute('aria-disabled','false')
        await expect(other).to_have_attribute('aria-pressed','true')
        print('PASS: failed save retains previous pick and supports retry')
        await page.locator('#roundFinalizeButton').click()
        await expect(page.locator('#roundFinalizeWarning')).to_be_visible()
        await expect(page.locator('#roundFinalizeButton')).to_have_text('Confirmar mesmo assim')
        await page.locator('[data-game-id="2"] [data-pick="DEN"]').click()
        await expect(page.locator('#picksDone')).to_have_text('2')
        await page.locator('#roundFinalizeButton').click()
        await expect(page.locator('#roundFinalize')).to_have_class(re.compile('is-confirmed'))
        print('PASS: incomplete-round warning and complete-round confirmation')
        await page.locator('[data-info-dialog="how"]').click()
        await expect(page.locator('#infoDialog')).to_be_visible()
        await page.keyboard.press('Escape')
        await expect(page.locator('#infoDialog')).not_to_be_visible()
        await expect(page.locator('[data-info-dialog="how"]')).to_be_focused()
        for width in (390,320):
            await page.set_viewport_size({'width':width,'height':844})
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            await page.evaluate('window.scrollTo(0,0)')
            await page.screenshot(path=str(OUT/f'home-{width}.png'),full_page=True)
        print('PASS: dialog keyboard/focus; mobile 390px and 320px without horizontal overflow')
        ranking_start=len(calls)
        await page.locator('.bottom-nav a[href="ranking.html"]').click()
        await page.wait_for_url('**/ranking.html');await expect(page.locator('.rank-row')).to_have_count(2)
        await page.wait_for_load_state('networkidle')
        assert len(calls[ranking_start:]) <= 4, calls[ranking_start:]
        profile_button=page.locator('[data-profile-user]').first
        await profile_button.focus();await profile_button.press('Enter')
        await expect(page.locator('#playerProfileDialog')).to_be_visible()
        await page.keyboard.press('Escape')
        await page.screenshot(path=str(OUT/'ranking-mobile.png'),full_page=True)
        print('PASS: real page navigation and keyboard-accessible player profile')
        reduced=await browser.new_context(reduced_motion='reduce',service_workers='block',viewport={'width':390,'height':844})
        await reduced.route('https://*.supabase.co/**',api)
        await reduced.add_init_script('localStorage.setItem("sb-wueaswmbujgitfxydphh-auth-token",'+json.dumps(json.dumps(SESSION))+');')
        reduced_page=await reduced.new_page();await reduced_page.clock.set_fixed_time(datetime(2026,11,16,12,tzinfo=timezone.utc))
        await reduced_page.goto('http://127.0.0.1:8000/index.html',wait_until='networkidle')
        assert await reduced_page.evaluate('document.getAnimations().length')==0
        print('PASS: reduced-motion disables entry, selection and live animations')
        mode['empty']=True
        empty=await new_page('index.html');await expect(empty.locator('.empty-games')).to_be_visible()
        await expect(empty.locator('#roundFinalize')).not_to_be_visible()
        mode['empty']=False;mode['get_error']=True
        failed=await new_page('index.html');await expect(failed.locator('[data-retry]')).to_be_visible()
        await expect(failed.locator('.empty-games')).to_have_count(0)
        await expect(failed.locator('.is-loading')).to_have_count(0)
        await expect(failed.locator('.skeleton-line')).to_have_count(0)
        mode['get_error']=False
        await failed.locator('[data-retry]').click();await expect(failed.locator('.pick-button')).to_have_count(4)
        print('PASS: empty round differs from unavailable data; retry restores games')
        for route in ('estatisticas.html','historico.html','mais.html'):
            extra=await new_page(route);await extra.wait_for_load_state('networkidle')
            await extra.set_viewport_size({'width':390,'height':844})
            assert await extra.evaluate('document.documentElement.scrollWidth <= innerWidth'),route
            await extra.screenshot(path=str(OUT/route.replace('.html','.png')),full_page=True)
        print('PASS: stats, history and account render in mobile without overflow')
        assert errors==[],errors
        print('PASS: no uncaught JavaScript errors; all writes intercepted by fixture API')
        print('Screenshots:',OUT)
        await browser.close()
if __name__ == "__main__":
    asyncio.run(main())
