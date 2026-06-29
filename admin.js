const defaults={
 products:[{name:'평안 염주',price:'25,000원',desc:'마음의 불안을 내려놓고 평안과 안정을 전하는 염주입니다.'}],
 reviews:[], reservations:[], payments:[], coupons:[], members:[]
};
function getJSON(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
function safe(v){return String(v||'').replace(/[<>&]/g,s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}
function renderList(key,boxId,fields,defaultsKey){
 const box=document.getElementById(boxId); if(!box)return;
 const items=getJSON(key, defaults[defaultsKey]||[]);
 box.innerHTML=items.map((x,i)=>`<div class="adminItem">${fields.map(f=>`<p><b>${f.label}:</b> ${safe(x[f.key])}</p>`).join('')}<button class="danger" onclick="delItem('${key}',${i},'${defaultsKey}')">삭제</button></div>`).join('')||'<p>등록된 내용이 없습니다.</p>';
}
function delItem(k,i,defaultsKey){const items=getJSON(k, defaults[defaultsKey]||[]);items.splice(i,1);setJSON(k,items);renderAll()}
function renderAll(){
 renderList('cheonyulProducts','adminProductList',[{key:'name',label:'상품명'},{key:'price',label:'가격'},{key:'desc',label:'설명'}],'products');
 renderList('cheonyulReviews','adminReviewList',[{key:'title',label:'제목'},{key:'text',label:'내용'}],'reviews');
 renderList('cheonyulReservations','adminReservationList',[{key:'name',label:'예약자'},{key:'type',label:'종류'},{key:'time',label:'시간'},{key:'status',label:'상태'}],'reservations');
 renderList('cheonyulPayments','adminPaymentList',[{key:'name',label:'입금자'},{key:'amount',label:'금액'},{key:'status',label:'상태'}],'payments');
 renderList('cheonyulCoupons','adminCouponList',[{key:'name',label:'쿠폰명'},{key:'benefit',label:'혜택'}],'coupons');
 renderList('cheonyulMembers','adminMemberList',[{key:'name',label:'회원명'},{key:'memo',label:'메모'}],'members');
}
function addItem(k,obj,defaultsKey){const items=getJSON(k, defaults[defaultsKey]||[]);items.push(obj);setJSON(k,items);renderAll()}
window.addEventListener('load',()=>{
 const preview=document.getElementById('adminProfilePreview');
 const saved=localStorage.getItem('cheonyulProfileImage');
 if(saved && preview) preview.src=saved;

 document.getElementById('saveProfileImage').onclick=()=>{
   const file=document.getElementById('profileImageInput').files[0];
   if(!file){alert('이미지를 먼저 선택해 주세요.');return;}
   const reader=new FileReader();
   reader.onload=()=>{localStorage.setItem('cheonyulProfileImage',reader.result);preview.src=reader.result;alert('프로필 이미지가 저장되었습니다.');};
   reader.readAsDataURL(file);
 };
 document.getElementById('resetProfileImage').onclick=()=>{
   localStorage.removeItem('cheonyulProfileImage');
   preview.src='./assets/cheonyul_profile.png';
   alert('기본 이미지로 복구되었습니다.');
 };

 document.getElementById('addProduct').onclick=()=>{
   if(!productName.value.trim() || !productPrice.value.trim()){alert('상품명과 가격을 입력해 주세요.');return;}
   addItem('cheonyulProducts',{name:productName.value.trim(),price:productPrice.value.trim(),desc:productDesc.value.trim()},'products');
   productName.value=productPrice.value=productDesc.value='';
 };
 document.getElementById('addReview').onclick=()=>{
   if(!reviewTitle.value.trim() || !reviewText.value.trim()){alert('후기 제목과 내용을 입력해 주세요.');return;}
   addItem('cheonyulReviews',{title:reviewTitle.value.trim(),text:reviewText.value.trim()},'reviews');
   reviewTitle.value=reviewText.value='';
 };
 document.getElementById('saveNotice').onclick=()=>{localStorage.setItem('cheonyulNotice',noticeText.value.trim());alert('공지 저장 완료')};
 document.getElementById('clearNotice').onclick=()=>{localStorage.removeItem('cheonyulNotice');noticeText.value='';alert('공지 삭제 완료')};
 document.getElementById('addReservation').onclick=()=>{
   addItem('cheonyulReservations',{name:resName.value.trim(),type:resType.value.trim(),time:resTime.value.trim(),status:'예약대기'},'reservations');
   resName.value=resType.value=resTime.value='';
 };
 document.getElementById('addPayment').onclick=()=>{
   addItem('cheonyulPayments',{name:payName.value.trim(),amount:payAmount.value.trim(),status:payStatus.value},'payments');
   payName.value=payAmount.value='';
 };
 document.getElementById('addCoupon').onclick=()=>{
   addItem('cheonyulCoupons',{name:couponName.value.trim(),benefit:couponBenefit.value.trim()},'coupons');
   couponName.value=couponBenefit.value='';
 };
 document.getElementById('addMember').onclick=()=>{
   addItem('cheonyulMembers',{name:memberName.value.trim(),memo:memberMemo.value.trim()},'members');
   memberName.value=memberMemo.value='';
 };

 noticeText.value=localStorage.getItem('cheonyulNotice')||'';
 if(!localStorage.getItem('cheonyulProducts')) setJSON('cheonyulProducts', defaults.products);
 renderAll();
});