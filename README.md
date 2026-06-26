# 천명신당 이미지 업로드 + 게시판 버전

추가:
- 상품 등록 시 이미지 파일 직접 업로드
- 게시판 글 등록
- 게시판 이미지 파일 업로드
- Firebase Storage 사용

중요:
Firebase 콘솔에서 Storage를 만들어야 이미지 업로드가 됩니다.
Storage 규칙은 테스트 단계에서 아래처럼 설정하면 됩니다.
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
