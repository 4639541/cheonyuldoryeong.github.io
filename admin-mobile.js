const defaultProducts=[{name:'평안 염주',price:'25,000원',desc:'마음의 불안을 내려놓고 평안과 안정을 전하는 염주입니다.'}];
function getJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch(e){return fallback}}
function setJSON(key,val){localStorage.setItem(key,JSON.stringify(val))}
function renderAdminProducts(){const box=document.getElementById('adminProductList');const items=getJSON('cheonyulProducts',defaultProducts);box.innerHTML=items.map((p,i)=>`<div class="adminItem"><b>${p.name}</b><p>${p.price}</p><p>${p.desc||''}</p><button class="danger" onclick="deleteProduct(${i})">삭제</button></div>`).join('')}
function renderAdminReviews(){const box=document.getElementById('adminReviewList');const items=getJSON('cheonyulReviews',[]);box.innerHTML=items.map((r,i)=>`<div class="adminItem"><b>${r.title}</b><p>${r.text}</p><button class="danger" onclick="deleteReview(${i})">삭제</button></div>`).join('')||'<p>등록된 후기가 없습니다.</p>'}
function deleteProduct(i){const items=getJSON('cheonyulProducts',defaultProducts);items.splice(i,1);setJSON('cheonyulProducts',items);renderAdminProducts()}
function deleteReview(i){const items=getJSON('cheonyulReviews',[]);items.splice(i,1);setJSON('cheonyulReviews',items);renderAdminReviews()}
window.addEventListener('load',()=>{
 const preview=document.getElementById('adminProfilePreview');const saved=localStorage.getItem('cheonyulProfileImage');if(saved)preview.src=saved;
 document.getElementById('saveProfileImage').onclick=()=>{const file=document.getElementById('profileImageInput').files[0];if(!file){alert('이미지를 먼저 선택해 주세요.');return;}const reader=new FileReader();reader.onload=()=>{localStorage.setItem('cheonyulProfileImage',reader.result);preview.src=reader.result;alert('프로필 이미지가 저장되었습니다.');};reader.readAsDataURL(file);};
 document.getElementById('resetProfileImage').onclick=()=>{localStorage.removeItem('cheonyulProfileImage');preview.src='./assets/cheonyul_profile.png';alert('기본 이미지로 복구되었습니다.');};
 document.getElementById('addProduct').onclick=()=>{const name=productName.value.trim();const price=productPrice.value.trim();const desc=productDesc.value.trim();if(!name||!price){alert('상품명과 가격을 입력해 주세요.');return;}const items=getJSON('cheonyulProducts',defaultProducts);items.push({name,price,desc});setJSON('cheonyulProducts',items);productName.value=productPrice.value=productDesc.value='';renderAdminProducts();};
 document.getElementById('addReview').onclick=()=>{const title=reviewTitle.value.trim();const text=reviewText.value.trim();if(!title||!text){alert('후기 제목과 내용을 입력해 주세요.');return;}const items=getJSON('cheonyulReviews',[]);items.push({title,text});setJSON('cheonyulReviews',items);reviewTitle.value=reviewText.value='';renderAdminReviews();};
 document.getElementById('saveNotice').onclick=()=>{localStorage.setItem('cheonyulNotice',noticeText.value.trim());alert('공지 저장 완료');};
 document.getElementById('clearNotice').onclick=()=>{localStorage.removeItem('cheonyulNotice');noticeText.value='';alert('공지 삭제 완료');};
 noticeText.value=localStorage.getItem('cheonyulNotice')||'';renderAdminProducts();renderAdminReviews();
});