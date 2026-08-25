const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const required = ['index.html', 'vercel.json', path.join('api', 'whatif-feedback.js')];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`필수 파일이 없습니다: ${file}`);
}

const browserSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'api', 'whatif-feedback.js'), 'utf8');

if (browserSource.includes('GROQ_API_KEY') || browserSource.includes('api.groq.com')) {
  throw new Error('브라우저 배포 파일에 Groq 서버 설정이 포함되어 있습니다.');
}
if (/gsk_[A-Za-z0-9_-]{16,}/.test(browserSource + serverSource)) {
  throw new Error('소스 코드에 Groq API 키로 보이는 값이 포함되어 있습니다.');
}

console.log('정적 앱 및 Vercel 서버리스 함수 빌드 검사를 통과했습니다.');
