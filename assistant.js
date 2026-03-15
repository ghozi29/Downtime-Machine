import { db, ref, onValue } from "./firebase-config.js"

let records=[]
let components=[]


// ambil data maintenance

onValue(ref(db,"area/hormon/records"),(snapshot)=>{

records=[]

snapshot.forEach(child=>{

records.push({
id:child.key,
...child.val()
})

})

})


// ambil data komponen

onValue(ref(db,"area/hormon/components"),(snapshot)=>{

components=[]

snapshot.forEach(child=>{

components.push({
id:child.key,
...child.val()
})

})

})


// kirim pertanyaan

window.askAI=function(){

const input=document.getElementById("chatInput")

const question=input.value.toLowerCase()

if(!question) return

addMessage(question,"user")

const answer=processQuestion(question)

setTimeout(()=>{

addMessage(answer,"bot")

},400)

input.value=""

}



function addMessage(text,type){

const box=document.getElementById("chatMessages")

const div=document.createElement("div")

div.className=type=="user"?"userMsg":"botMsg"

div.innerText=text

box.appendChild(div)

box.scrollTop=box.scrollHeight

}



function processQuestion(q){

if(records.length==0){

return "Data maintenance belum tersedia."

}


// downtime tertinggi

if(q.includes("downtime tertinggi")){

let machines={}

records.forEach(r=>{

let m=r.machineName||"Unknown"

let d=r.downtimeTotal||r.downtimeHours||0

machines[m]=(machines[m]||0)+d

})

let sorted=Object.entries(machines)

.sort((a,b)=>b[1]-a[1])

return `Mesin dengan downtime tertinggi adalah ${sorted[0][0]} dengan total ${sorted[0][1].toFixed(2)} jam.`

}


// MTTR

if(q.includes("mttr")){

let total=0
let count=0

records.forEach(r=>{

if(r.repairTime){

total+=r.repairTime
count++

}

})

if(count==0) return "Data MTTR belum tersedia."

return `MTTR rata-rata adalah ${(total/count).toFixed(2)} jam.`

}


// MTBF

if(q.includes("mtbf")){

let total=0
let count=0

records.forEach(r=>{

if(r.operatingTime){

total+=r.operatingTime
count++

}

})

if(count==0) return "Data MTBF belum tersedia."

return `MTBF rata-rata adalah ${(total/count).toFixed(2)} jam.`

}


// kategori kerusakan

if(q.includes("kategori")){

let cat={}

records.forEach(r=>{

let c=r.category||"lainnya"

cat[c]=(cat[c]||0)+1

})

let sorted=Object.entries(cat)

.sort((a,b)=>b[1]-a[1])

return `Kategori kerusakan paling sering adalah ${sorted[0][0]} dengan ${sorted[0][1]} kejadian.`

}


// komponen paling sering diganti

if(q.includes("komponen")){

let comp={}

components.forEach(c=>{

let n=c.componentName||"unknown"

comp[n]=(comp[n]||0)+1

})

let sorted=Object.entries(comp)

.sort((a,b)=>b[1]-a[1])

return `Komponen yang paling sering diganti adalah ${sorted[0][0]} sebanyak ${sorted[0][1]} kali.`

}


return "Saya bisa menjawab tentang MTTR, MTBF, downtime tertinggi, kategori kerusakan, atau komponen."

}
