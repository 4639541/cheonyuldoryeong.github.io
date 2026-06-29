const defaults={products:[{name:'평안 염주',price:'25,000원',desc:'마음의 불안을 내려놓고 평안과 안정을 전하는 염주입니다.'}],reviews:[],reservations:[],payments:[],coupons:[],members:[]};
function getJSON(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
function renderList(key,boxId,fields){
 const box=document.getElementById(boxId); if(!box)return;
 const items=getJSON(key,[]);
 box.innerHTML=items.map((x,i)=>`<div class="adminItem">${fields.map(f=>`<p><b>${f}:</b> ${x[f]||''}</p>`).join('')}<button class="danger" onclick="delItem('${key}',${i})">삭제</button></div>`).join('')||'<p>등록된 내용이 없습니다.</p>';
}
function delItem(k,i){const items=getJSON(k,[]);items.splice(i,1);setJSON(k,items);renderAll()}
function renderAll(){
 renderList('cheonyulProducts','adminProductList',['name','price','desc']);
 renderList('cheonyulReviews','adminReviewList',['title','text']);
 renderList('cheonyulReservations','adminReservationList',['name','type','time','status']);
 renderList('cheonyulPayments','adminPaymentList',['name','amount','status']);
 renderList('cheonyulCoupons','adminCouponList',['name','benefit']);
 renderList('cheonyulMembers','adminMemberList',['name','memo']);
}
function addItem(k,obj){const items=getJSON(k,[]);items.push(obj);setJSON(k,items);renderAll()}
window.addEventListener('load',()=>{
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
   document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));
   document.querySelectorAll('.adminPanel').forEach(x=>x.classList.remove('active'));
   b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active');
 });
 const preview=document.getElementById('adminProfilePreview'); const saved=localStorage.getItem('cheonyulProfileImage'); if(saved)preview.src=saved;
 saveProfileImage.onclick=()=>{const file=profileImageInput.files[0]; if(!file){alert('이미지를 먼저 선택해 주세요.');return;} const reader=new FileReader(); reader.onload=()=>{localStorage.setItem('cheonyulProfileImage',reader.result); preview.src=reader.result; alert('프로필 이미지가 저장되었습니다.');}; reader.readAsDataURL(file);};
 resetProfileImage.onclick=()=>{localStorage.removeItem('cheonyulProfileImage'); preview.src='./assets/cheonyul_profile.png'; alert('기본 이미지로 복구되었습니다.');};
 addProduct.onclick=()=>addItem('cheonyulProducts',{name:productName.value,price:productPrice.value,desc:productDesc.value});
 addReview.onclick=()=>addItem('cheonyulReviews',{title:reviewTitle.value,text:reviewText.value});
 saveNotice.onclick=()=>{localStorage.setItem('cheonyulNotice',noticeText.value);alert('공지 저장 완료')};
 clearNotice.onclick=()=>{localStorage.removeItem('cheonyulNotice');noticeText.value='';alert('공지 삭제 완료')};
 addReservation.onclick=()=>addItem('cheonyulReservations',{name:resName.value,type:resType.value,time:resTime.value,status:'예약대기'});
 addPayment.onclick=()=>addItem('cheonyulPayments',{name:payName.value,amount:payAmount.value,status:payStatus.value});
 addCoupon.onclick=()=>addItem('cheonyulCoupons',{name:couponName.value,benefit:couponBenefit.value});
 addMember.onclick=()=>addItem('cheonyulMembers',{name:memberName.value,memo:memberMemo.value});
 noticeText.value=localStorage.getItem('cheonyulNotice')||''; 
 if(!localStorage.getItem('cheonyulProducts')) setJSON('cheonyulProducts', defaults.products);
 renderAll();
});