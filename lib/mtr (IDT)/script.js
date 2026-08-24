
function showLoader(){
    $("#loader").show();
}

function hideLoader(){
    $("#loader").hide();
}

var copyText = ``;
var qs = new URLSearchParams(window.location.search);
var find_station = qs.get("station");
var find_platform = "";
if(qs.has("platform")){
    find_platform = qs.get("platform");
}

var terminalStation = {
    "AEL": ["AWE","CEN"],
    "NSL": ["ADM","LMC","LOW"],
    "ISL": ["KET","CHW"],
    "KTL": ["TIK","WHA"],
    "TCL": ["TUC","HOK"],
    "TKL": ["NOP","POA","LHP"],
    "TWL": ["TSW","CEN"],
    "EWL": ["WKS","TUM"],
    "SIL": ["ADM","SOH"],
    "DRL": ["SUN","DIS"]
  }

var lineList = ["AEL","NSL","ISL","KTL","TCL","TKL","TWL","EWL","SIL","DRL"]
var realJson = {};
  
var content_for_apply = ``;

var isLine =  ( find_station == "SIL" || find_station == "DRL" ) ?  "true" : "false" ; 
var platform_list =[];
var term_list = [];
var station_term_list = [];
var resort_list = [];
var genTime = "";
var now_showing = "ALL" ;
var now_showing_direction = "";
var allow_1time = 0;   //只可以同時做一次  no use async .
var sorted_station = [];
function resetDate(data){
    var t = new Date(data);
    console.log("[getTime] => " + t.toLocaleString("en-US"))
    genTime = t.toLocaleString("en-US") ;
}
function getJson_station(fisrt=false){
    console.log("isLine : "+ isLine)
    if( allow_1time == 0 ){
        
        showLoader();
        allow_1time = 1 ; 
        platform_list =[];
        term_list = [];
        station_term_list = [];
        resort_list = [];
        var settings = {
            "url": "https://408tq84duh.execute-api.ap-east-1.amazonaws.com/api/service/GetNextTrainData",
            //"url": "http://192.168.15.110:3001/train-data",
            "method": "POST",
            "timeout": 0,
            "headers": {
            "Content-Type": "application/json"
            },
            "data": JSON.stringify({"stationcode":`${find_station}`}),
        };
        console.log(settings);
        
        $.ajax(settings).done(function (response) {
            hideLoader();
            console.log("response" + response);
            realJson = JSON.parse(response) ;
            resetDate( realJson.gen_time );
            $.each( realJson.line ,function(line_name, line_data){
                if(lineList.includes(line_name)){
                    var tmp_term_list = [];
                    $.each( line_data , function(platform_name, data){
                        platform_list.push(platform_name)  ; 
                        $.each( data, function(k, v){
                            if( term_list.filter(function(x){ return x == v['destination']}).length < 1){
                                term_list.push(v['destination']) ; 
                            }
                            if( tmp_term_list.filter(function(x){ return x == v['destination']}).length < 1){
                                tmp_term_list.push(v['destination']) ; 
                            }
                            if( sorted_station.filter(function(x){ return x.station == v['destination']}).length < 1){
                                sorted_station.push({"line":line_name,"station":v['destination'],"PF":parseInt(platform_name)}); 
                            }
                            station_term_list.push({"station":line_name, tmp_term_list})  // for ASIL
                            var sup_data = {"line":line_name,"platform":platform_name}
                            var remake_json = Object.assign(sup_data , v)
                            resort_list.push(remake_json);
                        })
                    })
                }
            })
            console.log("platform_list", platform_list);
            console.log("term_list", term_list);
            console.log("station_term_list", station_term_list);
            console.log("resort_list", resort_list);
            /*
            if( resort_list.length < 1 ){
                $('#warn1').html(`Missing Station Code`) ;
                $('#warn1').show();
                $(`.termlist`).hide();
                $(`.linelist`).hide();
                $(`.termlist_forASIL`).hide();
            }else{
                $('#warn1').hide();
                $(`.termlist`).show();
            }
            */
            applyTermList();
            if(fisrt){
                if(qs.has("platform")){
                    now_showing = "PLAT"
                }
            }
            applyMainTable() ;
            allow_1time = 0 ;
            
            if( resort_list.length < 1 ){
                $('#warn1').html(`Missing Station Code`) ;
                $('#warn1').show();
                $(`.termlist`).hide();
                $(`.linelist`).hide();
                $(`.termlist_forASIL`).hide();
            }
        });
      
    }
    
}
function applyTermList(){
    //$(`#termlist`).html(`<div data-plat="ALL" class="allbtn" style="background-color: #35598f; color:#cbe6ff; border-radius:15px;" >ALL</div><div id="platBtn" data-plat="PLAT" style="background-color: #35598f; color:#cbe6ff; border-radius:15px;">PLAT</div>`);
    var term_list_html = `<span style="font-size: 4.5vw; padding-top: 15px; margin-left: 5px; float: left;">To&nbsp;</span>`;
    term_list = [];
    $.each(sorted_station.sort(function(a,b){return a.PF - b.PF}) ,function(k ,v ){
        if(v.line == "DRL") return;
        term_list_html += `<div data-plat="${v.station}" class="${v.line}">${v.station}</div>`;
        term_list.push(v.station)
    });
    term_list_html += `<div data-plat="ALL" class="allbtn" style="background-color: #35598f; color:#cbe6ff; border-radius:15px; padding: 5px 8px;">ALL</div>`;
    $("#termlist_station").html(term_list_html);
    
    if(qs.has("platform") && isLine == "false"){
        $("#platBtn").html(`PF${find_platform}`)
    }else{
        $("#platBtn").hide();
    }


    var stationLs = ``;
    var useThis = [];
    
    $.each(station_term_list ,function(k ,v ){
        if( useThis.filter(function(skipItem){ return skipItem == v.station}) < 1 ){
            useThis.push(v.station) ;
        }
    });
    useThis.sort() ;
    $.each(useThis ,function(k ,v ){
            stationLs += `<div data-station="${v}">${v}</div>` ;
    });
    //$("#lineList_forASIL").html(`<div data-station="ALL" class="allbtn" style="background-color:#35598f; color: #cbe6ff; border-radius:15px;" >ALL</div>`);
    $("#lineList_forASIL").html(`<span style="font-size: 4.5vw; padding-top: 15px; margin-left: 5px;">From&nbsp;</span>`);
    //$("#lineList_forASIL").html(`<span style="font-size: 4.5vw; padding-top: 35px; margin-left: 5px;">From&nbsp;</span>`);
    $("#lineList_forASIL").append(stationLs) ;
    $("#lineList_forASIL").append(`<div data-station="ALL" class="allbtn" style="background-color:#35598f; color: #cbe6ff; border-radius:15px; padding: 5px 8px;">ALL</div>`) ;


    if( isLine == "false"){
        $(`#termlist`).html(`<span style="margin-left: 5px;padding-top: 15px;">From&nbsp${find_station}</span>`);
        $("#lineList_forASIL").hide() ; 
    }else{
        $(`#termlist`).html(`<span style="margin-left: 5px;padding-top: 15px;">Line&nbsp${find_station}</span>`);
        $("#termlist_station").hide() ; 
    }

}

function to1min(line, station, ttnt){
    var word = ttnt == 0 ? "Departing" : ttnt == 1 ? "Arriving" : ttnt ; 
    $.each( terminalStation, function(l ,sl ){
        $.each ( sl, function(useless, stat ){
            if( l == line && stat == station && word == "Arriving"){
                word = ttnt ;
            }
        })

    })

    
    return word ; 
}

function toTTAD(line, station, tta, ttd){
    var word =tta;
    $.each( terminalStation, function(l ,sl ){
        $.each ( sl, function(useless, stat ){
            if( l == line && stat == station ){
                word = ttd  ;
            }
        })
    })
    return word ; 
}   

function applyMainTable(){
    $("#update-time").html(genTime);
    $(".sche_BigBox").html(``) ; 
    $(".table_content_list").html(``) ; 
    if( isLine == "false" ){
        var add_to_sche_BigBox =``;
        $.each(term_list ,function(i ,j ){
            var add_to_tableContentList = ``;
            $.each(resort_list ,function(k ,v ){
                if( v.destination == j){
                    add_to_tableContentList += `<div class="table_content ${v.platform}" data-plat="${v.platform}">
                                                    <div>${v.destination}</div>
                                                    <div>${v.platform}</div>
                                                    <div>${/*to1min(v.line , j, v.ttnt)*/(v.line == "NSL" || v.line == "EWL")? toTTAD(v.line,v.destination,v.tta,v.ttd):  to1min(v.line , j, v.ttnt)}</div>
                                                    <div class="tdCol">
                                                        <div>${v.td}</div>
                                                        <div class="copyBtn" data-copy="${v.td}">COPY</div>
                                                        <textarea id="${v.td}" readonly style="position: fixed; top: 0; left: 0; opacity:0 ;width: 0px; height:0px; overflow: hidden;" autocomplete="off">${transform_Copy(v.td)}</textarea>
                                                    </div>
                                                </div>`;
                }
            })
            add_to_sche_BigBox += `<div class="term_box ${j} ${now_showing}${j}" data-item="${j}"> 
                                        <div class="line_dir">Current: ${j}</div>
                                        <div class="train-info" style="font-size:4vw;">
                                                <div class="table_title">
                                                    <div>Destination</div>
                                                    <div>Platform</div>
                                                    <div>Min</div>
                                                    <div>TD</div>
                                                </div>
                                                <div class="table_content_list">
                                                    ${add_to_tableContentList}
                                                </div>
                                                <hr/>
                                        </div>
                                    </div>` ;
        })
    }else{  

        var useThis = [];
        
        $.each(station_term_list  ,function(a ,b ){

            if( useThis.filter(function(useItem){ return useItem.station == b.station}) < 1 ){  // 跳過 station_term_list 重覆野
            
                useThis.push(b);
            }
        });
        useThis.sort(function(a,b){return a.station > b.station ? 1:-1});
        console.log("useThis-----------" , useThis);
        var add_to_sche_BigBox =``;
        $.each(useThis  ,function(a ,b ){
                $.each(b.tmp_term_list ,function(c ,d ){
                    var add_to_tableContentList = ``;
                    $.each(resort_list ,function(e ,f ){
                            if( d == f.destination && b.station == f.station){
                                add_to_tableContentList += `<div class="table_content ${f.platform} " data-plat="${f.platform}">
                                                                <div>${f.destination}</div>
                                                                <div>${f.platform}</div>
                                                                <div>${/*to1min(v.line , j, v.ttnt)*/(f.line == "NSL" || f.line == "EWL")? toTTAD(f.line, f.destination, f.tta, f.ttd):  to1min(f.line , b.station, f.ttnt)}</div>
                                                                <div class="tdCol">
                                                                    <div>${f.td}</div>
                                                                    <div class="copyBtn" data-copy="${f.td}">COPY</div>
                                                                    <textarea id="${f.td}" readonly style="position: fixed; top: 0; left: 0; opacity:0 ;width: 0px; height:0px; overflow: hidden;" autocomplete="off">${transform_Copy(f.td)}</textarea>
                                                                </div>
                                                            </div>`;
                            }
                    
                    })
                    
                        add_to_sche_BigBox += `<div class="term_box ${d} ${b.station}${d} f_${b.station}" data-item="${d}"> 
                                                    <div class="line_dir">(${ b.station }) To ${d}</div>
                                                    <div class="train-info" style="font-size:4vw;">
                                                            <div class="table_title">
                                                                <div>Destination</div>
                                                                <div>Platform</div>
                                                                <div>Min</div>
                                                                <div>TD</div>
                                                            </div>
                                                            <div class="table_content_list">
                                                                ${add_to_tableContentList}
                                                            </div>
                                                            <hr/>
                                                    </div>
                                                </div>` ;
                })

        })

    }

    $(".sche_BigBox").append(add_to_sche_BigBox);
    switchShowHideData();
    
}

function switchShowHideData(){
    console.log("now_showing_direction.....", now_showing_direction);
    if( now_showing == "ALL"){

        $(".term_box").show();
    }
    else if( now_showing == "PLAT"){
        showDefault();
    }else {
        /*
        $.each($(".term_box").get() , function(k, v){
            console.log($(v).attr("data-item")) ; 
            if( $(v).attr("data-item") != now_showing){
                $(v).hide();
            }
        })
        */
       if( isLine == "true"){
        
        $(".term_box").hide();
        if( now_showing_direction != "" ){
            $(`.${now_showing}${now_showing_direction}`).show();
        }else{
            $(`.f_${now_showing}`).show();
        }
    }else{

        $(".term_box").hide();
        $(`.${now_showing}`).show();
       }

    }
    
    btn_iden(now_showing, now_showing_direction);
}

function showDefault(){
    
    if(qs.has("platform")){
        now_showing = "PLAT" ;
        find_platform = qs.get("platform");
        $(".term_box").hide();
        $(".table_content").hide();
        $.each( $(`.table_content`).get() , function(k ,v ){

            if( $(v).attr("data-plat") == find_platform){
                $(v).parents(".term_box").show();
                $(v).show();
            }
        })
        
    }
}


function change_show_terminal(station, direction=""){
    now_showing = station ;
    now_showing_direction = direction ;
    applyMainTable() ;
    
}

function change_show_directBtn(station){
    now_showing = station ;
    now_showing_direction = "";
    var directionLs = ``;
    var useThis = [];

    $.each(station_term_list ,function(k ,v ){
        
        $.each(v.tmp_term_list ,function( vkey , vname){
            if( v.station == station ){
                if( useThis.filter(function(skipItem){ return skipItem == vname}).length <1  ){
                    useThis.push(vname);
                }
            }
        })
    });

    $.each(useThis ,function(k ,v ){
        directionLs += `<div data-direction="${v}">${v}</div>` ;
    })
    if(directionLs){
        directionLs = `<span style="font-size: 4.5vw; padding-top: 15px; margin-left: 5px">To&nbsp;</span>` + directionLs
    }
    console.log("useThis...", useThis)
    $("#termlist_forASIL").html(``);
    $("#termlist_forASIL").append(directionLs) ;
    $("#termlist_forASIL").show();
    
    switchShowHideData();
}

$(document).ready(function(){
    showLoader();

    
    getJson_station(true); 
    
});
function btn_iden(s , dir=""){
    $(".termlist div").css({"box-shadow":"none"}) ;
    $(`.termlist div[data-plat='${s}']`).css({"box-shadow":"0px 0px 20px 0px grey"}) ;

    
    $("#lineList_forASIL div").css({"box-shadow":"none"}) ;
    $(`#lineList_forASIL div[data-station='${s}']`).css({"box-shadow":"0px 0px 20px 0px grey"}) ;
    
    $("#termlist_forASIL div").css({"box-shadow":"none"}) ;
    $(`#termlist_forASIL div[data-direction='${dir}']`).css({"box-shadow":"0px 0px 20px 0px grey"}) ;
}
$(document).on("click", ".termlist div", function(self){
    console.log(self) ;
    console.log("[Data] Station " + $(self.target).attr("data-plat") + " is displayed") ;
    change_show_terminal($(self.target).attr("data-plat")) ;
})

$(document).on("click", "#lineList_forASIL div", function(self){
    console.log(self) ;
    console.log("[Data] Station " + $(self.target).attr("data-station") + " is displayed") ;
    change_show_directBtn($(self.target).attr("data-station"));
})

$(document).on("click", "#termlist_forASIL div", function(self){
    console.log(self) ;
    console.log("[Data] direction " + $(self.target).attr("data-direction") + " is displayed") ;
    change_show_terminal(now_showing, $(self.target).attr("data-direction"));
})

$(document).on("click", "#reBtn", function(self){
    console.log(self) ;
    console.log("[js function] manual refreshing data..  ")  ;
    showLoader();
    now_showing = "ALL" ;
    getJson_station(true) ;
    $("#termlist_forASIL").hide();
    clearInterval(autoRefresh);
    autoRefresh = setInterval( refresh, 60000) ;
})

var autoRefresh = setInterval( refresh, 60000) ;

function refresh(){
    console.log("...");
    getJson_station() ;
}

function manual_refresh(){
    getJson_station(true) ;
}

$(document).on("click", ".copyBtn", function(self){
    console.log(self) ;
    console.log("[Copy]", $(self.target).attr("data-copy")) ;

    $(".copyBtn").css({"color": "black", "text-decoration" : "none"});
    $(self.target).css({"color": "purple", "text-decoration" : "underline"});
    var str = $(self.target).attr("data-copy")
    copyTask(str) ;
})

function copyTask(s){
    var str = document.getElementById(s);
    copyText = str.innerHTML ;
    //window.getSelection(str) ;
    str.select();
    document.execCommand('copy');
    showCopyhints(copyText);

}
function showCopyhints(s){
    $("#copyed_hints").html("[Copied Text] : \" <div>" + s + "</div> \"");
    $("#copyed_hints").css({"display":"flex"});
    setTimeout(() => {
        $("#copyed_hints").hide();
    }, 850);
}
function transform_Copy(s){
    var word = s.slice(0,2) == "H1" ? s.replaceAll("H1","") : 
    s.slice(0,3) == "JM0" ? s.replaceAll("JM0","")  : 
    s.slice(0,3) == "JL0" ? s.replaceAll("JL0","")  : 
    s.slice(0,2) == "37" ? s.slice(2,5) : 
    s.slice(0,2) == "41" ? s.slice(2,5)  : 
    s.slice(0,2) == "18" ? s.slice(2,5)  : 
    s.slice(0,2) == "21" ? s.slice(2,5)  : s.replaceAll(/[a-z]/gi,"") ;

    return word ;
}

/* zoom */

/* zoom pull*/
document.documentElement.addEventListener(
    'touchstart',
    function(event){
        if( event.touches.length > 1){
            event.preventDefault()
        }
    },{
        passive: false
    }

)


/* zoom double-click*/
var lastTouchEnd = 0 ;
document.documentElement.addEventListener(
    'touchend',
    function(event){
        var now = Date.now()
        if( now - lastTouchEnd <= 300){
            event.preventDefault();
        }
        lastTouchEnd = now
    },
    {
        passive: false
    }
)

var lastTouchst = 0 ;
document.documentElement.addEventListener(
    'touchstart',
    function(event){
        var now = Date.now()
        if( now - lastTouchst <= 300){
            event.preventDefault();
        }
        lastTouchst = now
    },
    {
        passive: false
    }
)
/* zoom */