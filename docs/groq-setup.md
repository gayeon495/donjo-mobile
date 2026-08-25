# Groq 환경변수 설정

이 프로젝트는 브라우저가 아닌 Vercel 서버리스 함수에서만 Groq API를 호출합니다. API 키 값을 소스 코드나 채팅에 입력하지 마세요.

1. [Groq Console API Keys](https://console.groq.com/keys)에서 무료 API 키를 직접 생성합니다.
2. Vercel 대시보드에서 `donjo-mobile` 프로젝트를 엽니다.
3. **Settings → Environment Variables**로 이동합니다.
4. 이름에 `GROQ_API_KEY`, 값에 직접 생성한 키를 입력합니다.
5. Production, Preview, Development 중 사용할 환경을 선택하고 저장합니다.
6. **Deployments**에서 최신 배포의 메뉴를 열고 **Redeploy**를 실행합니다.

모델은 Groq 무료 플랜과 강한 다국어 출력을 지원하는 `qwen/qwen3.6-27b`를 사용합니다. 결제 등록이나 유료 플랜 전환은 필요하지 않습니다.
