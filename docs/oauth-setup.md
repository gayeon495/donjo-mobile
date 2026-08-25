# 소셜 로그인 연결 설정

앱 코드는 Supabase Auth를 사용해 이메일 회원가입·로그인, Google 로그인, Naver 로그인을 처리합니다. 소셜 로그인은 각 서비스의 비공개 Client Secret이 필요하므로, 이 파일의 값을 코드나 GitHub에 넣지 말고 Supabase 대시보드에서만 설정합니다.

## 공통 Redirect URL

Supabase Dashboard → Authentication → URL Configuration에서 아래 URL을 추가합니다.

```text
https://donjo-mobile.vercel.app/**
donjo://auth/callback
```

Supabase 프로젝트의 OAuth Callback URL은 다음입니다. Google과 Naver 개발자 콘솔의 Callback URL에도 같은 값을 등록합니다.

```text
https://htrahqollyqainzlsabz.supabase.co/auth/v1/callback
```

## Google

1. Google Cloud Console에서 OAuth 2.0 Web Client를 만듭니다.
2. 위 Supabase OAuth Callback URL을 승인된 리디렉션 URI로 등록합니다.
3. Supabase Dashboard → Authentication → Providers → Google에서 활성화합니다.
4. Google Client ID와 Client Secret을 해당 화면에 입력하고 저장합니다.

## Naver

1. Naver Developers에서 애플리케이션을 등록하고 네이버 로그인 사용을 설정합니다.
2. Callback URL에 위 Supabase OAuth Callback URL을 등록합니다.
3. Supabase Dashboard → Authentication → Providers → Add provider에서 Custom OAuth를 추가하고 Provider ID를 `naver`로 설정합니다.
4. Naver Client ID와 Client Secret을 입력하고 다음 OAuth 2.0 endpoint를 설정합니다.

```text
Authorization URL: https://nid.naver.com/oauth2.0/authorize
Token URL:         https://nid.naver.com/oauth2.0/token
User info URL:     https://openapi.naver.com/v1/nid/me
```

저장 뒤 앱의 **Naver로 계속하기** 버튼은 Supabase custom provider `custom:naver`를 사용합니다.

## 확인 방법

1. Vercel에 배포된 앱에서 회원가입 또는 소셜 로그인 버튼을 누릅니다.
2. 인증이 끝나면 앱으로 돌아와 `마이 → 데이터 관리`에 “Supabase에 동기화됐어요.”가 표시되는지 확인합니다.
3. Supabase Dashboard → Table Editor에서 `financial_profiles`, `expenses`, `cash_flows`, `goals`, `notification_settings`에 현재 로그인한 사용자의 `user_id` 데이터가 생성됐는지 확인합니다.
