
   //ตั้งเวลาเปิดการลงคะแนนเสียง
		    var future = Date.parse("January 02, 2026 06:00:00");
   //ตั้งเวลาปิดการลงคะแนนเสียง 
		    var future2 = Date.parse("January 02, 2026 14:00:00");
		    var timeEnd = 0;
		    var status =0;
		    
			function updateTimer() {

			   var now = new Date();
				if (future - now < 0){
					timeEnd = future2 ; 
					status = 1
				}else{
					timeEnd = future ;
					status = 0
					}
				if (future2 - now < 0){ 
					status = 2
			  	}
			   
			 diff = timeEnd - now;

			 days = Math.floor(diff / (1000 * 60 * 60 * 24));
			 hours = Math.floor(diff / (1000 * 60 * 60));
			 mins = Math.floor(diff / (1000 * 60));
			 secs = Math.floor(diff / 1000);

			 d = days;
			 h = hours - days * 24;
			 m = mins - hours * 60;
			 s = secs - mins * 60;
			 h = h < 10 ? "0" + h : h;
			 m = m < 10 ? "0" + m : m;
       s = s < 10 ? "0" + s : s;
             
			 document.getElementById("timer").innerHTML =
        '<h2 class="mt-4" text-warning;">เหลือเวลาอีก</h2>' + 
			  '<div>' + d + '<span>วัน</span></div>' +
			  '<div>' + h + '<span>ชั่วโมง</span></div>' +
			  '<div>' + m + '<span>นาที</span></div>' +
			  '<div>' + s + '<span>วินาที</span></div>';

    /**  -- ควบคุมการเปิดหน้าต่างๆ คามเวลาที่กำหนด -- **/
			  if (status== 0){
				     document.getElementById("msgStatus").innerHTML =`<h2>จะเปิดให้เล่นกิจกรรมทายหวย  </h2> <img src="https://media0.giphy.com/media/AgBce8OuQ5mbencR1H/200w.webp?cid=ecf05e47kxj12cpe8nbd0m4lddbapg86iir9027qrx22bqb3&ep=v1_gifs_related&rid=200w.webp&ct=s" alt="Girl in a jacket" style="width:370px;height:300px;">`
             document.getElementById("btnResult").style.display="none";
             document.getElementById("cover").style.display="none";
				 }else
			 if (status== 1){
				    document.getElementById("msgStatus").innerHTML ="<h2>จะปิดให้ทายหวย</h2>"
            // document.getElementById("btnResult").style.display="none";
            document.getElementById("cover").style.display="block";
            
				}else{
					  document.getElementById("msgStatus").innerHTML =
'<div class="card"><div class="card-body">'+						  
'<h2><center><img src="https://i.pinimg.com/originals/10/6b/68/106b68071a23586acfc1e3220740482f.gif" alt="Girl in a jacket" style="width:370px;height:300px;">'+
'<h2 class="text-danger">ขณะนี้ปิดระบบการทายหวยแล้วค่ะ</h2>'+
'<input type="button" class="btn btn-danger"'+
'style="font-weight: bold; display: inline;" value="ปิดหน้านี้" onclick="closeMe()"> </center>'+
'</div></div>';
					  document.getElementById("timer").style.display="none";
            document.getElementById("cover").style.display="none";
            // document.getElementById("btnResult").style.display="block";
                        
				}
			}
			setInterval('updateTimer()', 1000);
