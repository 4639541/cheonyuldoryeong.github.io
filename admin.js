import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app), storage=getStorage(app);

window.adminLogin=async()=>{
  try{ await signInWithEmailAndPassword(auth,adminEmail.value.trim(),adminPassword.value); }
  catch(e){ alert("로그인 실패: 이메일 또는 비밀번호를 확인해 주세요."); }
};
window.adminLogout=()=>signOut(auth);
onAuthStateChanged(auth,u=>{
  loginBox.classList.toggle("hidden",!!u);
  adminPanel.classList.toggle("hidden",!u);
  if(u) loadAll();
});

async function uploadFiles(fileList,folder){
  const urls=[];
  for(const file of Array.from(fileList||[])){
    const r=ref(storage,`${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(r,file);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
async function uploadOne(file,folder){
  const urls=await uploadFiles(file?[file]:[],folder);
  return urls[0]||"";
}
window.addProduct=async()=>{
  if(!pName.value||!pPrice.value) return alert("상품명과 가격을 입력해 주세요.");
  productStatus.textContent="이미지 업로드 중...";
  const images=await uploadFiles(pImages.files,"products");
  await addDoc(collection(db,"products"),{name:pName.value,category:pCategory.value,price:pPrice.value,sale:pSale.value,stock:pStock.value||"주문 가능",desc:pDesc.value,best:pBest.checked,images,createdAt:serverTimestamp()});
  pName.value=pCategory.value=pPrice.value=pSale.value=pStock.value=pDesc.value=""; pImages.value=""; pBest.checked=false;
  productStatus.textContent="등록 완료"; loadAll();
};
window.addPost=async()=>{
  if(!postTitle.value||!postBody.value) return alert("제목과 내용을 입력해 주세요.");
  postStatus.textContent="이미지 업로드 중...";
  const images=await uploadFiles(postImages.files,"posts");
  await addDoc(collection(db,"posts"),{title:postTitle.value,body:postBody.value,images,createdAt:serverTimestamp()});
  postTitle.value=postBody.value=""; postImages.value=""; postStatus.textContent="등록 완료"; loadAll();
};
window.addField=async()=>{
  if(!fieldTitle.value||!fieldBody.value) return alert("상담 분야와 설명을 입력해 주세요.");
  await addDoc(collection(db,"fields"),{title:fieldTitle.value,body:fieldBody.value,createdAt:serverTimestamp()});
  fieldTitle.value=fieldBody.value=""; loadAll();
};
window.addNotice=async()=>{
  if(!noticeTitle.value||!noticeBody.value) return alert("공지 제목과 내용을 입력해 주세요.");
  await addDoc(collection(db,"notices"),{tag:noticeTag.value||"공지",title:noticeTitle.value,body:noticeBody.value,createdAt:serverTimestamp()});
  noticeTag.value=noticeTitle.value=noticeBody.value=""; loadAll();
};
window.addDirectReview=async()=>{
  if(!reviewDirectName.value||!reviewDirectBody.value) return alert("이름과 후기 내용을 입력해 주세요.");
  const image=await uploadOne(reviewDirectImage.files[0],"reviews");
  await addDoc(collection(db,"reviews"),{name:reviewDirectName.value,category:reviewDirectCategory.value,stars:reviewDirectStars.value,body:reviewDirectBody.value,image,approved:true,createdAt:serverTimestamp()});
  reviewDirectName.value=reviewDirectCategory.value=reviewDirectBody.value=""; reviewDirectImage.value=""; loadAll();
};

async function getList(col){
  const s=await getDocs(query(collection(db,col),orderBy("createdAt","desc")));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
function imgs(item){
  const arr=item.images || (item.image?[item.image]:[]);
  return arr.slice(0,3).map(i=>`<img class="thumb" src="${i}">`).join("");
}
async function fill(col,box,html){
  try{ const arr=await getList(col); box.innerHTML=arr.map(html).join("") || "<p>등록된 내용이 없습니다.</p>"; return arr.length; }
  catch(e){ box.innerHTML="<p>불러오기 실패</p>"; return 0; }
}
async function loadAll(){
  const orderCount=await fill("orders",orderAdminList,o=>`<div class="adminItem"><b>${o.name||""} · ${o.total||""}</b><p>${(o.items||[]).map(i=>`${i.name} ${i.qty}개`).join("<br>")}<br>연락처: ${o.contact||""}<br>주소: ${o.address||""}<br><span class="status">${o.status||"신규"}</span></p><div class="actions"><button onclick="setStatus('orders','${o.id}','확인중')">확인중</button><button onclick="setStatus('orders','${o.id}','완료')">완료</button><button onclick="del('orders','${o.id}')">삭제</button></div></div>`);
  const bookingCount=await fill("bookings",bookingAdminList,b=>`<div class="adminItem"><b>${b.name||""} · ${b.type||""}</b><p>${b.contact||""}<br>${b.date||""} ${b.time||""}<br>${b.body||""}<br><span class="status">${b.status||"대기"}</span></p><div class="actions"><button onclick="setStatus('bookings','${b.id}','확정')">확정</button><button onclick="setStatus('bookings','${b.id}','완료')">완료</button><button onclick="del('bookings','${b.id}')">삭제</button></div></div>`);
  const productCount=await fill("products",productAdminList,p=>`<div class="adminItem"><b>${p.name||""} · ${p.price||""}</b><p>${p.category||""} / ${p.stock||""}<br>${p.desc||""}</p>${imgs(p)}<div class="actions"><button onclick="del('products','${p.id}')">삭제</button></div></div>`);
  await fill("posts",postAdminList,p=>`<div class="adminItem"><b>${p.title||""}</b><p>${p.body||""}</p>${imgs(p)}<button onclick="del('posts','${p.id}')">삭제</button></div>`);
  await fill("fields",fieldAdminList,f=>`<div class="adminItem"><b>${f.title||""}</b><p>${f.body||""}</p><button onclick="del('fields','${f.id}')">삭제</button></div>`);
  await fill("notices",noticeAdminList,n=>`<div class="adminItem"><b>[${n.tag||"공지"}] ${n.title||""}</b><p>${n.body||""}</p><button onclick="del('notices','${n.id}')">삭제</button></div>`);
  const pending=await getDocs(query(collection(db,"reviews"),where("approved","==",false),orderBy("createdAt","desc")));
  pendingReviewList.innerHTML=pending.docs.map(d=>{const r={id:d.id,...d.data()};return `<div class="adminItem"><b>${r.name||""} · ${r.category||""} · ${r.stars||""}</b><p>${r.body||""}</p>${r.image?`<img class="thumb" src="${r.image}">`:""}<div class="actions"><button onclick="approveReview('${r.id}')">승인</button><button onclick="del('reviews','${r.id}')">삭제</button></div></div>`}).join("")||"<p>승인 대기 후기가 없습니다.</p>";
  const approved=await getDocs(query(collection(db,"reviews"),where("approved","==",true),orderBy("createdAt","desc")));
  approvedReviewList.innerHTML=approved.docs.map(d=>{const r={id:d.id,...d.data()};return `<div class="adminItem"><b>${r.name||""} · ${r.category||""} · ${r.stars||""}</b><p>${r.body||""}</p>${r.image?`<img class="thumb" src="${r.image}">`:""}<button onclick="del('reviews','${r.id}')">삭제</button></div>`}).join("")||"<p>공개 후기가 없습니다.</p>";
  statOrders.textContent=orderCount; statBookings.textContent=bookingCount; statProducts.textContent=productCount; statReviews.textContent=pending.docs.length+approved.docs.length;
}
window.setStatus=async(col,id,status)=>{ await updateDoc(doc(db,col,id),{status}); loadAll(); };
window.approveReview=async(id)=>{ await updateDoc(doc(db,"reviews",id),{approved:true}); loadAll(); };
window.del=async(col,id)=>{ if(confirm("삭제할까요?")){ await deleteDoc(doc(db,col,id)); loadAll(); } };
