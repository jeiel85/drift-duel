# itch.io 등록 안내

## 업로드 파일 만들기

```bash
npm run pack:itch
```

`dist-itch/`에 게임 화면만 빌드하고(`play.html`이 `index.html`이 되고, 소개 페이지 전용 이미지는 빠집니다) `release/drift-duel-itch.zip`으로 묶습니다.
압축 루트에 `index.html`이 있고 `dist-itch/`와 같은 파일입니다. `dist-itch/`와 `release/`는 git에 올리지 않습니다.

## 프로젝트 설정 (Create new project)

| 항목 | 값 |
|---|---|
| Title | Drift Duel |
| Kind of project | **HTML** |
| Uploads | `drift-duel-itch.zip` 업로드 후 **This file will be played in the browser** 체크 |
| Embed options → Viewport dimensions | 1280 × 720 |
| Embed options | **Mobile friendly** 체크(Orientation: Default — 세로·가로 모두 지원), **Fullscreen button** 체크, **Automatically start on page load** 끔(소리는 클릭 뒤에 나므로) |
| Classification | Games · Racing |
| Tags | `racing`, `drift`, `3d`, `cars`, `arcade`, `low-poly`, `mobile`, `physics`, `singleplayer`, `webgl` |
| Release status | Released |
| Pricing | No payments (원하면 Donate) |
| Cover image | [`cover.jpg`](cover.jpg) (630×500, 실제 레이스 화면 `docs/screenshot-race.png`에서 잘라 만듦) |
| Screenshots | `docs/screenshot-race.png`, `docs/screenshot-mobile.jpg`, `docs/screenshot-touch-guide.png` |

## 게임 동작 메모

- itch.io는 게임을 다른 도메인(itch.zone)의 iframe 안에서 실행합니다. 메뉴 아래 **← About the game ↗** 링크는 iframe 안에서는 새 탭으로 웹 버전 소개 페이지(https://jeiel85.github.io/drift-duel/)를 엽니다. 업로드에는 소개 페이지가 없기 때문입니다.
- 휴대폰에서 레이스를 시작할 때 전체 화면을 요청하지만, iframe이 전체 화면을 허용하지 않으면 조용히 건너뛰고 창 모드로 계속합니다. 전체 화면은 itch의 Fullscreen 버튼을 쓰면 됩니다. 화면 꺼짐 방지(Wake Lock)도 iframe에서 막히면 건너뜁니다.
- 기록·설정·언어 선택은 itch.zone 쪽 브라우저 저장소에 따로 저장되어 웹 버전·APK의 기록과 공유되지 않습니다. 저장소가 막힌 환경에서도 게임은 그대로 실행되고, 그 세션 동안만 기록이 유지됩니다.
- 언어는 브라우저 언어를 따라 한국어 또는 영어로 시작하고(그 외 언어는 영어), 메뉴 오른쪽 위 **English / 한국어** 버튼으로 바꿀 수 있습니다. 저장소가 막혀 있으면 주소의 `?lang=`으로 선택을 이어 갑니다.
- 오류 화면의 "Report a problem" 링크는 GitHub 이슈 작성 화면을 새 탭으로 엽니다. 직접 제출하기 전에는 아무것도 전송되지 않습니다.
- 게임에는 공유·초대 링크나 클립보드 기능이 없어서 iframe에서 따로 막히는 기능은 위 항목들뿐입니다.

## 페이지 소개문 (그대로 붙여 넣기)

```
DRIFT DUEL is a 3D drift racing duel you play right in the browser — on a phone with two thumbs, or on a keyboard.

The car accelerates on its own. Turn in early to throw it into a slide, hold the drift to charge nitro, then fire the nitro and beat your rival to the line.

FEATURES
• Arcade drift physics: carry speed into a hard turn and the rear lets go; the game models oversteer and grip recovery, at a fixed 120 Hz step
• Nitro and combos: slip angle × speed builds drift points and nitro; long drifts raise the multiplier up to ×4, but a hard wall hit wipes the combo
• Boosts: a start boost (press just before GO), a drift boost when you straighten up out of a drift with open road ahead, and yellow dash pads
• An AI rival on the same physics as you, in Easy, Normal and Hard
• 3 tracks: Sunset Harbor (3 laps), Red Canyon (2 laps) and Neon Rain (2 laps, wet, 10% less grip)
• 4 cars: Street, Muscle, Off-Road and Super — beat a Hard rival once to unlock the Super car, Zenith R
• Driving assist for touch (on by default): limits the slide so you don't spin, and nudges you away from the walls
• Phone-friendly: portrait or landscape, vibration feedback, automatic quality scaling when the frame rate drops
• Best time per track, wins and unlocks are saved in your browser
• Engine and tyre sounds synthesised live with Web Audio; every texture is generated in code — zero image or sound files
• English and Korean

CONTROLS
Phone: press the left or right half of the screen to steer (a quick tap nudges, a hold turns hard) · swipe up or tap NITRO for nitro · press both sides to brake/reverse · ⏸ to pause
Keyboard: ← → / A D steer · hold Space or Shift for nitro · ↓ / S brake/reverse · ↑ / W / Space just before GO for the start boost · P / Esc pause

Also on the web and as an Android APK: https://jeiel85.github.io/drift-duel/
Source code (MIT): https://github.com/jeiel85/drift-duel
```
