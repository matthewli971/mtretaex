/* ============================================
   MTR ETA Web App - data.js
   Static reference data for stations & lines.
   Edit this file to update stations or line info.
   ============================================ */


// Home station setting (change this to set default station)
var HOME_STATION = "ADM";

// All MTR stations
// Fields: station_id, station_code, name_chi, name_eng, lines[], station_colour, station_font_colour
var stationsData = [
  { "station_id": 1,   "station_code": "CEN", "name_chi": "中環",     "name_eng": "Central",              "lines": ["ISL","TWL"],            "station_colour": "#AA0000",  "station_font_colour": "#FFFFFF", "hotline": "2921 2710" },
  { "station_id": 2,   "station_code": "ADM", "name_chi": "金鐘",     "name_eng": "Admiralty",            "lines": ["EAL","ISL","SIL","TWL"],"station_colour": "#3A86D4",  "station_font_colour": "#FFFFFF", "hotline": "2922 1400" },
  { "station_id": 3,   "station_code": "TST", "name_chi": "尖沙咀",   "name_eng": "Tsim Sha Tsui",        "lines": ["TWL"],                  "station_colour": "#FFEF00",  "station_font_colour": "#000000", "hotline": "2926 1200" },
  { "station_id": 4,   "station_code": "JOR", "name_chi": "佐敦",     "name_eng": "Jordan",               "lines": ["TWL"],                  "station_colour": "#69B72B",  "station_font_colour": "#FFFFFF", "hotline": "2926 1201" },
  { "station_id": 5,   "station_code": "YMT", "name_chi": "油麻地",   "name_eng": "Yau Ma Tei",           "lines": ["KTL","TWL"],            "station_colour": "#CCCCCC",  "station_font_colour": "#000000", "hotline": "2928 6210" },
  { "station_id": 6,   "station_code": "MOK", "name_chi": "旺角",     "name_eng": "Mong Kok",             "lines": ["KTL","TWL"],            "station_colour": "#BE2700",  "station_font_colour": "#FFFFFF", "hotline": "2928 4220" },
  { "station_id": 7,   "station_code": "SKM", "name_chi": "石硤尾",   "name_eng": "Shek Kip Mei",         "lines": ["KTL"],                  "station_colour": "#669933",  "station_font_colour": "#FFFFFF", "hotline": "2928 2300" },
  { "station_id": 8,   "station_code": "KOT", "name_chi": "九龍塘",   "name_eng": "Kowloon Tong",         "lines": ["EAL","KTL"],            "station_colour": "#007FFF",  "station_font_colour": "#FFFFFF", "hotline": "2926 7310" },
  { "station_id": 9,   "station_code": "LOF", "name_chi": "樂富",     "name_eng": "Lok Fu",               "lines": ["KTL"],                  "station_colour": "#579E2F",  "station_font_colour": "#FFFFFF", "hotline": "2926 7311" },
  { "station_id": 10,  "station_code": "WTS", "name_chi": "黃大仙",   "name_eng": "Wong Tai Sin",         "lines": ["KTL"],                  "station_colour": "#FFFF00",  "station_font_colour": "#000000", "hotline": "2927 6320" },
  { "station_id": 11,  "station_code": "DIH", "name_chi": "鑽石山",   "name_eng": "Diamond Hill",         "lines": ["KTL","TML"],            "station_colour": "#000000",  "station_font_colour": "#FFFFFF", "hotline": "2431 1588" },
  { "station_id": 12,  "station_code": "CHH", "name_chi": "彩虹",     "name_eng": "Choi Hung",            "lines": ["KTL"],                  "station_colour": "#27408B",  "station_font_colour": "#FFFFFF", "hotline": "2927 6322" },
  { "station_id": 13,  "station_code": "KOB", "name_chi": "九龍灣",   "name_eng": "Kowloon Bay",          "lines": ["KTL"],                  "station_colour": "#C80815",  "station_font_colour": "#FFFFFF", "hotline": "2927 4330" },
  { "station_id": 14,  "station_code": "NTK", "name_chi": "牛頭角",   "name_eng": "Ngau Tau Kok",         "lines": ["KTL"],                  "station_colour": "#92B6A3",  "station_font_colour": "#FFFFFF", "hotline": "2927 3340" },
  { "station_id": 15,  "station_code": "KWT", "name_chi": "觀塘",     "name_eng": "Kwun Tong",            "lines": ["KTL"],                  "station_colour": "#FFFFFF",  "station_font_colour": "#000000", "hotline": "2927 3341" },
  { "station_id": 16,  "station_code": "PRE", "name_chi": "太子",     "name_eng": "Prince Edward",        "lines": ["KTL","TWL"],            "station_colour": "#8674A1",  "station_font_colour": "#FFFFFF", "hotline": "2928 4221" },
  { "station_id": 17,  "station_code": "SSP", "name_chi": "深水埗",   "name_eng": "Sham Shui Po",         "lines": ["TWL"],                  "station_colour": "#016258",  "station_font_colour": "#FFFFFF", "hotline": "2928 7230" },
  { "station_id": 18,  "station_code": "CSW", "name_chi": "長沙灣",   "name_eng": "Cheung Sha Wan",       "lines": ["TWL"],                  "station_colour": "#B5A265",  "station_font_colour": "#000000", "hotline": "2928 7231" },
  { "station_id": 19,  "station_code": "LCK", "name_chi": "茘枝角",   "name_eng": "Lai Chi Kok",          "lines": ["TWL"],                  "station_colour": "#E04300",  "station_font_colour": "#FFFFFF", "hotline": "2928 3040" },
  { "station_id": 20,  "station_code": "MEF", "name_chi": "美孚",     "name_eng": "Mei Foo",              "lines": ["TML","TWL"],            "station_colour": "#1E90FF",  "station_font_colour": "#FFFFFF", "hotline": "2175 2801" },
  { "station_id": 21,  "station_code": "LAK", "name_chi": "茘景",     "name_eng": "Lai King",             "lines": ["TCL","TWL"],            "station_colour": "#BB2200",  "station_font_colour": "#FFFFFF", "hotline": "2928 3042" },
  { "station_id": 22,  "station_code": "KWF", "name_chi": "葵芳",     "name_eng": "Kwai Fong",            "lines": ["TWL"],                  "station_colour": "#233D3A",  "station_font_colour": "#FFFFFF", "hotline": "2920 2050" },
  { "station_id": 23,  "station_code": "KWH", "name_chi": "葵興",     "name_eng": "Kwai Hing",            "lines": ["TWL"],                  "station_colour": "#F1CC00",  "station_font_colour": "#000000", "hotline": "2920 2051" },
  { "station_id": 24,  "station_code": "TWH", "name_chi": "大窩口",   "name_eng": "Tai Wo Hau",           "lines": ["TWL"],                  "station_colour": "#A2B741",  "station_font_colour": "#FFFFFF", "hotline": "2920 3566" },
  { "station_id": 25,  "station_code": "TSW", "name_chi": "荃灣",     "name_eng": "Tsuen Wan",            "lines": ["TWL"],                  "station_colour": "#BB2200",  "station_font_colour": "#FFFFFF", "hotline": "2920 3560" },
  { "station_id": 26,  "station_code": "SHW", "name_chi": "上環",     "name_eng": "Sheung Wan",           "lines": ["ISL"],                  "station_colour": "#FFD280",  "station_font_colour": "#6B4513", "hotline": "2921 6700" },
  { "station_id": 27,  "station_code": "WAC", "name_chi": "灣仔",     "name_eng": "Wan Chai",             "lines": ["ISL"],                  "station_colour": "#E1EB2B",  "station_font_colour": "#000000", "hotline": "2923 5026" },
  { "station_id": 28,  "station_code": "CAB", "name_chi": "銅鑼灣",   "name_eng": "Causeway Bay",         "lines": ["ISL"],                  "station_colour": "#C8A2C8",  "station_font_colour": "#FFFFFF", "hotline": "2923 5031" },
  { "station_id": 29,  "station_code": "TIH", "name_chi": "天后",     "name_eng": "Tin Hau",              "lines": ["ISL"],                  "station_colour": "#FF7D00",  "station_font_colour": "#FFFFFF", "hotline": "2922 3740" },
  { "station_id": 30,  "station_code": "FOH", "name_chi": "炮台山",   "name_eng": "Fortress Hill",        "lines": ["ISL"],                  "station_colour": "#4B8842",  "station_font_colour": "#FFFFFF", "hotline": "2922 3741" },
  { "station_id": 31,  "station_code": "NOP", "name_chi": "北角",     "name_eng": "North Point",          "lines": ["ISL","TKL"],            "station_colour": "#E86220",  "station_font_colour": "#000000", "hotline": "2922 4750" },
  { "station_id": 32,  "station_code": "QUB", "name_chi": "鰂魚涌",   "name_eng": "Quarry Bay",           "lines": ["ISL","TKL"],            "station_colour": "#00918C",  "station_font_colour": "#FFFFFF", "hotline": "2922 4751" },
  { "station_id": 33,  "station_code": "TAK", "name_chi": "太古",     "name_eng": "Tai Koo",              "lines": ["ISL"],                  "station_colour": "#BB2200",  "station_font_colour": "#FFFFFF", "hotline": "2922 4752" },
  { "station_id": 34,  "station_code": "SWH", "name_chi": "西灣河",   "name_eng": "Sai Wan Ho",           "lines": ["ISL"],                  "station_colour": "#FFCC00",  "station_font_colour": "#000000", "hotline": "2922 7760" },
  { "station_id": 35,  "station_code": "SKW", "name_chi": "筲箕灣",   "name_eng": "Shau Kei Wan",         "lines": ["ISL"],                  "station_colour": "#191970",  "station_font_colour": "#FFFFFF", "hotline": "2922 7761" },
  { "station_id": 36,  "station_code": "HFC", "name_chi": "杏花邨",   "name_eng": "Heng Fa Chuen",        "lines": ["ISL"],                  "station_colour": "#C01204",  "station_font_colour": "#FFFFFF", "hotline": "2921 5770" },
  { "station_id": 37,  "station_code": "CHW", "name_chi": "柴灣",     "name_eng": "Chai Wan",             "lines": ["ISL"],                  "station_colour": "#38510E",  "station_font_colour": "#FFFFFF", "hotline": "2921 5771" },
  { "station_id": 38,  "station_code": "LAT", "name_chi": "藍田",     "name_eng": "Lam Tin",              "lines": ["KTL"],                  "station_colour": "#0083BE",  "station_font_colour": "#FFFFFF", "hotline": "2927 7350" },
  { "station_id": 39,  "station_code": "HOK", "name_chi": "香港",     "name_eng": "Hong Kong",            "lines": ["AEL","TCL"],            "station_colour": "#FFFAFA",  "station_font_colour": "#000000", "hotline": "2523 3627" },
  { "station_id": 40,  "station_code": "KOW", "name_chi": "九龍",     "name_eng": "Kowloon",              "lines": ["AEL","TCL"],            "station_colour": "#ACA28A",  "station_font_colour": "#000000", "hotline": "2736 0162" },
  { "station_id": 41,  "station_code": "OLY", "name_chi": "奧運",     "name_eng": "Olympic",              "lines": ["TCL"],                  "station_colour": "#4584C4",  "station_font_colour": "#000000", "hotline": "2625 9635" },
  { "station_id": 42,  "station_code": "TSY", "name_chi": "青衣",     "name_eng": "Tsing Yi",             "lines": ["AEL","TCL"],            "station_colour": "#A1C6CA",  "station_font_colour": "#000000", "hotline": "2449 9059" },
  { "station_id": 43,  "station_code": "TUC", "name_chi": "東涌",     "name_eng": "Tung Chung",           "lines": ["TCL"],                  "station_colour": "#6A5ACD",  "station_font_colour": "#C0C0C0", "hotline": "2109 2516" },
  { "station_id": 47,  "station_code": "AIR", "name_chi": "機場",     "name_eng": "Airport",              "lines": ["AEL"],                  "station_colour": "#808080",  "station_font_colour": "#FFFFFF", "hotline": "2261 0522" },
  { "station_id": 48,  "station_code": "YAT", "name_chi": "油塘",     "name_eng": "Yau Tong",             "lines": ["KTL","TKL"],            "station_colour": "#FFEF00",  "station_font_colour": "#000000", "hotline": "2927 3110" },
  { "station_id": 49,  "station_code": "TIK", "name_chi": "調景嶺",   "name_eng": "Tiu Keng Leng",        "lines": ["KTL","TKL"],            "station_colour": "#DCD144",  "station_font_colour": "#000000", "hotline": "2927 2086" },
  { "station_id": 50,  "station_code": "TKO", "name_chi": "將軍澳",   "name_eng": "Tseung Kwan O",        "lines": ["TKL"],                  "station_colour": "#E60012",  "station_font_colour": "#FFFFFF", "hotline": "2927 2087" },
  { "station_id": 51,  "station_code": "HAH", "name_chi": "坑口",     "name_eng": "Hang Hau",             "lines": ["TKL"],                  "station_colour": "#2EA9DF",  "station_font_colour": "#000000", "hotline": "2927 2085" },
  { "station_id": 52,  "station_code": "POA", "name_chi": "寶琳",     "name_eng": "Po Lam",               "lines": ["TKL"],                  "station_colour": "#F28500",  "station_font_colour": "#000000", "hotline": "2927 2700" },
  { "station_id": 53,  "station_code": "NAC", "name_chi": "南昌",     "name_eng": "Nam Cheong",           "lines": ["TCL","TML"],            "station_colour": "#F0EE86",  "station_font_colour": "#000000", "hotline": "2624 2801" },
  { "station_id": 54,  "station_code": "SUN", "name_chi": "欣澳",     "name_eng": "Sunny Bay",            "lines": ["DRL","TCL"],            "station_colour": "#808080",  "station_font_colour": "#EEEEEE", "hotline": "2983 6961" },
  { "station_id": 55,  "station_code": "DIS", "name_chi": "迪士尼",   "name_eng": "Disneyland Resort",    "lines": ["DRL"],                  "station_colour": "#005533",  "station_font_colour": "#D4AF37", "hotline": "2983 6809" },
  { "station_id": 56,  "station_code": "AWE", "name_chi": "博覽館",   "name_eng": "AsiaWorld-Expo",       "lines": ["AEL"],                  "station_colour": "#FFFFFF",  "station_font_colour": "#000000", "hotline": "2215 3568" },
  { "station_id": 57,  "station_code": "LHP", "name_chi": "康城",     "name_eng": "LOHAS Park",           "lines": ["TKL"],                  "station_colour": "#826F79",  "station_font_colour": "#FFFFFF", "hotline": "2927 2087" },
  { "station_id": 64,  "station_code": "HUH", "name_chi": "紅磡",     "name_eng": "Hung Hom",             "lines": ["EAL","TML"],            "station_colour": "#F08080",  "station_font_colour": "#000000", "hotline": "2946 4405" },
  { "station_id": 65,  "station_code": "MKK", "name_chi": "旺角東",   "name_eng": "Mong Kok East",        "lines": ["EAL"],                  "station_colour": "#006400",  "station_font_colour": "#FFFFFF", "hotline": "2395 4986" },
  { "station_id": 67,  "station_code": "TAW", "name_chi": "大圍",     "name_eng": "Tai Wai",              "lines": ["EAL","TML"],            "station_colour": "#05117E",  "station_font_colour": "#FFFFFF", "hotline": "2605 9997" },
  { "station_id": 68,  "station_code": "SHT", "name_chi": "沙田",     "name_eng": "Sha Tin",              "lines": ["EAL"],                  "station_colour": "#BB7796",  "station_font_colour": "#FFFFFF", "hotline": "2605 3577" },
  { "station_id": 69,  "station_code": "FOT", "name_chi": "火炭",     "name_eng": "Fo Tan",               "lines": ["EAL"],                  "station_colour": "#FFA500",  "station_font_colour": "#FFFFFF", "hotline": "2604 8809" },
  { "station_id": 70,  "station_code": "RAC", "name_chi": "馬場",     "name_eng": "Racecourse",           "lines": ["EAL"],                  "station_colour": "#15AE69",  "station_font_colour": "#FFFFFF", "hotline": "2604 8809" },
  { "station_id": 71,  "station_code": "UNI", "name_chi": "大學",     "name_eng": "University",           "lines": ["EAL"],                  "station_colour": "#A2D7DD",  "station_font_colour": "#FFFFFF", "hotline": "2605 9039" },
  { "station_id": 72,  "station_code": "TAP", "name_chi": "大埔墟",   "name_eng": "Tai Po Market",        "lines": ["EAL"],                  "station_colour": "#976E9A",  "station_font_colour": "#FFFFFF", "hotline": "2658 7657" },
  { "station_id": 73,  "station_code": "TWO", "name_chi": "太和",     "name_eng": "Tai Wo",               "lines": ["EAL"],                  "station_colour": "#C89F05",  "station_font_colour": "#FFFFFF", "hotline": "2650 7097" },
  { "station_id": 74,  "station_code": "FAN", "name_chi": "粉嶺",     "name_eng": "Fanling",              "lines": ["EAL"],                  "station_colour": "#9ACD32",  "station_font_colour": "#FFFFFF", "hotline": "2676 1716" },
  { "station_id": 75,  "station_code": "SHS", "name_chi": "上水",     "name_eng": "Sheung Shui",          "lines": ["EAL"],                  "station_colour": "#F6A600",  "station_font_colour": "#FFFFFF", "hotline": "2673 0769" },
  { "station_id": 76,  "station_code": "LOW", "name_chi": "羅湖",     "name_eng": "Lo Wu",                "lines": ["EAL"],                  "station_colour": "#8DC476",  "station_font_colour": "#FFFFFF", "hotline": "2673 5406" },
  { "station_id": 78,  "station_code": "LMC", "name_chi": "落馬洲",   "name_eng": "Lok Ma Chau",          "lines": ["EAL"],                  "station_colour": "#009E9B",  "station_font_colour": "#FFFFFF", "hotline": "3404 6007" },
  { "station_id": 79,  "station_code": "KTU", "name_chi": "古洞",     "name_eng": "Kwu Tung",             "lines": ["EAL"],                  "station_colour": "#AD9D95",  "station_font_colour": "#FFFFFF", "hotline": null },
  { "station_id": 80,  "station_code": "ETS", "name_chi": "尖東",     "name_eng": "East Tsim Sha Tsui",   "lines": ["TML"],                  "station_colour": "#FFFF00",  "station_font_colour": "#000000", "hotline": "3471 5201" },
  { "station_id": 81,  "station_code": "SYP", "name_chi": "西營盤",   "name_eng": "Sai Ying Pun",         "lines": ["ISL"],                  "station_colour": "#8B7BA0",  "station_font_colour": "#000000", "hotline": "2803 7696" },
  { "station_id": 82,  "station_code": "HKU", "name_chi": "香港大學", "name_eng": "HKU",                  "lines": ["ISL"],                  "station_colour": "#B8DA89",  "station_font_colour": "#000000", "hotline": "2517 0933" },
  { "station_id": 83,  "station_code": "KET", "name_chi": "堅尼地城", "name_eng": "Kennedy Town",         "lines": ["ISL"],                  "station_colour": "#95D0D0",  "station_font_colour": "#000000", "hotline": "2307 5366" },
  { "station_id": 84,  "station_code": "HOM", "name_chi": "何文田",   "name_eng": "Ho Man Tin",           "lines": ["KTL","TML"],            "station_colour": "#A2CF5A",  "station_font_colour": "#000000", "hotline": "2274 5722" },
  { "station_id": 85,  "station_code": "WHA", "name_chi": "黃埔",     "name_eng": "Whampoa",              "lines": ["KTL"],                  "station_colour": "#AECFF0",  "station_font_colour": "#000000", "hotline": "2274 2622" },
  { "station_id": 86,  "station_code": "OCP", "name_chi": "海洋公園", "name_eng": "Ocean Park",           "lines": ["SIL"],                  "station_colour": "#00BFFF",  "station_font_colour": "#FFFFFF", "hotline": "2728 0104" },
  { "station_id": 87,  "station_code": "WCH", "name_chi": "黃竹坑",   "name_eng": "Wong Chuk Hang",       "lines": ["SIL"],                  "station_colour": "#FFFF00",  "station_font_colour": "#000000", "hotline": "2728 0104" },
  { "station_id": 88,  "station_code": "LET", "name_chi": "利東",     "name_eng": "Lei Tung",             "lines": ["SIL"],                  "station_colour": "#FF7F00",  "station_font_colour": "#FFFFFF", "hotline": "2728 0104" },
  { "station_id": 89,  "station_code": "SOH", "name_chi": "海怡半島", "name_eng": "South Horizons",       "lines": ["SIL"],                  "station_colour": "#74B11B",  "station_font_colour": "#FFFFFF", "hotline": "2728 0104" },
  { "station_id": 90,  "station_code": "HIK", "name_chi": "顯徑",     "name_eng": "Hin Keng",             "lines": ["TML"],                  "station_colour": "#8FBE6C",  "station_font_colour": "#182F4F", "hotline": "2171 4700" },
  { "station_id": 91,  "station_code": "KAT", "name_chi": "啟德",     "name_eng": "Kai Tak",              "lines": ["TML"],                  "station_colour": "#FF8C00",  "station_font_colour": "#000000", "hotline": "2445 2028" },
  { "station_id": 92,  "station_code": "SUW", "name_chi": "宋皇臺",   "name_eng": "Sung Wong Toi",        "lines": ["TML"],                  "station_colour": "#D08A00",  "station_font_colour": "#000000", "hotline": "2870 2455" },
  { "station_id": 93,  "station_code": "TKW", "name_chi": "土瓜灣",   "name_eng": "To Kwa Wan",           "lines": ["TML"],                  "station_colour": "#A9E2F3",  "station_font_colour": "#000000", "hotline": "2870 2455" },
  { "station_id": 94,  "station_code": "EXC", "name_chi": "會展",     "name_eng": "Exhibition Centre",    "lines": ["EAL"],                  "station_colour": "#94A8B0",  "station_font_colour": "#FFFFFF", "hotline": "2687 6211" },
  { "station_id": 96,  "station_code": "CKT", "name_chi": "車公廟",   "name_eng": "Che Kung Temple",      "lines": ["TML"],                  "station_colour": "#FFD280",  "station_font_colour": "#000000", "hotline": "2696 9790" },
  { "station_id": 97,  "station_code": "STW", "name_chi": "沙田圍",   "name_eng": "Sha Tin Wai",          "lines": ["TML"],                  "station_colour": "#FFC0CB",  "station_font_colour": "#000000", "hotline": "2144 5736" },
  { "station_id": 98,  "station_code": "CIO", "name_chi": "第一城",   "name_eng": "City One",             "lines": ["TML"],                  "station_colour": "#FFBF00",  "station_font_colour": "#000000", "hotline": "2637 5741" },
  { "station_id": 99,  "station_code": "SHM", "name_chi": "石門",     "name_eng": "Shek Mun",             "lines": ["TML"],                  "station_colour": "#FBEC5D",  "station_font_colour": "#000000", "hotline": "2635 4209" },
  { "station_id": 100, "station_code": "TSH", "name_chi": "大水坑",   "name_eng": "Tai Shui Hang",        "lines": ["TML"],                  "station_colour": "#48D1CC",  "station_font_colour": "#000000", "hotline": "2630 5125" },
  { "station_id": 101, "station_code": "HEO", "name_chi": "恆安",     "name_eng": "Heng On",              "lines": ["TML"],                  "station_colour": "#87CEFA",  "station_font_colour": "#000000", "hotline": "2630 5954" },
  { "station_id": 102, "station_code": "MOS", "name_chi": "馬鞍山",   "name_eng": "Ma On Shan",           "lines": ["TML"],                  "station_colour": "#E0B0FF",  "station_font_colour": "#000000", "hotline": "2630 5903" },
  { "station_id": 103, "station_code": "WKS", "name_chi": "烏溪沙",   "name_eng": "Wu Kai Sha",           "lines": ["TML"],                  "station_colour": "#954535",  "station_font_colour": "#FFFFFF", "hotline": "2631 6217" },
  { "station_id": 111, "station_code": "AUS", "name_chi": "柯士甸",   "name_eng": "Austin",               "lines": ["TML"],                  "station_colour": "#B45529",  "station_font_colour": "#FFFFFF", "hotline": "2314 5201" },
  { "station_id": 114, "station_code": "TWW", "name_chi": "荃灣西",   "name_eng": "Tsuen Wan West",       "lines": ["TML"],                  "station_colour": "#A81C07",  "station_font_colour": "#FFFFFF", "hotline": "2252 2801" },
  { "station_id": 115, "station_code": "KSR", "name_chi": "錦上路",   "name_eng": "Kam Sheung Road",      "lines": ["TML"],                  "station_colour": "#CC5500",  "station_font_colour": "#FFFFFF", "hotline": "2208 2801" },
  { "station_id": 116, "station_code": "YUL", "name_chi": "元朗",     "name_eng": "Yuen Long",            "lines": ["TML"],                  "station_colour": "#40F5F5",  "station_font_colour": "#000000", "hotline": "2256 2801" },
  { "station_id": 117, "station_code": "LOP", "name_chi": "朗屏",     "name_eng": "Long Ping",            "lines": ["TML"],                  "station_colour": "#FFB3BF",  "station_font_colour": "#000000", "hotline": "2257 2801" },
  { "station_id": 118, "station_code": "TIS", "name_chi": "天水圍",   "name_eng": "Tin Shui Wai",         "lines": ["TML"],                  "station_colour": "#FC8A17",  "station_font_colour": "#000000", "hotline": "2296 2801" },
  { "station_id": 119, "station_code": "SIH", "name_chi": "兆康",     "name_eng": "Siu Hong",             "lines": ["TML"],                  "station_colour": "#7FFFD4",  "station_font_colour": "#000000", "hotline": "2214 2801" },
  { "station_id": 120, "station_code": "TUM", "name_chi": "屯門",     "name_eng": "Tuen Mun",             "lines": ["TML"],                  "station_colour": "#035F94",  "station_font_colour": "#FFFFFF", "hotline": "2630 2801" }
];

// All MTR lines with station sequence and colour
// Fields: line_id, line_code, name_chi, name_eng, colour_code, stations[]
var linesData = [
  { "line_id": 1,  "line_code": "KTL", "name_chi": "觀塘綫",    "name_eng": "Kwun Tong Line",          "colour_code": "#00AB4E", "stations": ["WHA","HOM","YMT","MOK","PRE","SKM","KOT","LOF","WTS","DIH","CHH","KOB","NTK","KWT","LAT","YAT","TIK"] },
  { "line_id": 2,  "line_code": "TWL", "name_chi": "荃灣綫",    "name_eng": "Tsuen Wan Line",          "colour_code": "#ED1D24", "stations": ["CEN","ADM","TST","JOR","YMT","MOK","PRE","SSP","CSW","LCK","MEF","LAK","KWF","KWH","TWH","TSW"] },
  { "line_id": 3,  "line_code": "ISL", "name_chi": "港島綫",    "name_eng": "Island Line",             "colour_code": "#007DC5", "stations": ["KET","HKU","SYP","SHW","CEN","ADM","WAC","CAB","TIH","FOH","NOP","QUB","TAK","SWH","SKW","HFC","CHW"] },
  { "line_id": 4,  "line_code": "TKL", "name_chi": "將軍澳綫",  "name_eng": "Tseung Kwan O Line",      "colour_code": "#7D499D", "stations": ["NOP","QUB","YAT","TIK","TKO","HAH","POA","LHP"] },
  { "line_id": 5,  "line_code": "SIL", "name_chi": "南港島綫",  "name_eng": "South Island Line",       "colour_code": "#BAC429", "stations": ["ADM","OCP","WCH","LET","SOH"] },
  { "line_id": 6,  "line_code": "TCL", "name_chi": "東涌綫",    "name_eng": "Tung Chung Line",         "colour_code": "#F7943E", "stations": ["HOK","KOW","OLY","NAC","LAK","TSY","SUN","TUC"] },
  { "line_id": 7,  "line_code": "AEL", "name_chi": "機場快綫",  "name_eng": "Airport Express",        "colour_code": "#00888A", "stations": ["HOK","KOW","TSY","AIR","AWE"] },
  { "line_id": 8,  "line_code": "DRL", "name_chi": "迪士尼綫",  "name_eng": "Disneyland Resort Line",  "colour_code": "#F173AC", "stations": ["SUN","DIS"] },
  { "line_id": 9,  "line_code": "EAL", "name_chi": "東鐵綫",    "name_eng": "East Rail Line",          "colour_code": "#53B7E8", "stations": ["ADM","EXC","HUH","MKK","KOT","TAW","SHT","FOT","RAC","UNI","TAP","TWO","FAN","SHS","KTU","LOW","LMC"] },
  { "line_id": 10, "line_code": "TML", "name_chi": "屯馬綫",    "name_eng": "Tuen Ma Line",            "colour_code": "#923011", "stations": ["TUM","SIH","TIS","LOP","YUL","KSR","TWW","MEF","NAC","AUS","ETS","HUH","HOM","TKW","SUW","KAT","DIH","HIK","TAW","CKT","STW","CIO","SHM","TSH","HEO","MOS","WKS"] }
];

var alternativeNames = [
  { "NHUH": "HUH" }
];

var stationCodeMap = {
  "EAL": {
    '1': 'HUH',
    '2': 'MKK',
    '3': 'KOT',
    '4': 'TAW',
    '5': 'SHT',
    '6': 'FOT',
    '7': 'RAC',
    '8': 'UNI',
    '9': 'TAP',
    '10': 'TWO',
    '11': 'FAN',
    '12': 'SHS',
    '13': 'LOW',
    '14': 'LMC',
    '18': 'KTU',
    '21': 'HUH',
    '22': 'EXC',
    '23': 'ADM',
    '24': 'ADM Siding',
    '91': 'HTD',
    '92': 'HTD',
    '81': 'TEST',
    '82': 'TEST'
  },
  "TML": {
    '1': 'HUH',
    '14': 'ETS',
    '21': 'TAW',
    '22': 'CKT',
    '23': 'STW',
    '24': 'CIO',
    '25': 'SHM',
    '26': 'TSH',
    '27': 'HEO',
    '28': 'MOS',
    '29': 'WKS',
    '41': 'NAC',
    '42': 'MEF',
    '43': 'TWW',
    '44': 'KSR',
    '45': 'YUL',
    '46': 'LOP',
    '47': 'TIS',
    '48': 'SIH',
    '49': 'TUM',
    '50': 'AUS',
    '61': 'HOM',
    '62': 'TKW',
    '63': 'SUW',
    '64': 'KAT',
    '65': 'DIH',
    '66': 'HIK',
    '80': 'DEP',
    '91': 'DEP',
    '92': 'OUT',
    '93': 'SPC',
    '94': 'TES',
    '95': 'WR',
    '97': 'MOL'
  }, 
  "SIL": {
			'26': 'ADM',
			'27': 'ADM',
			'28': 'OCP',
			'29': 'OCP',
			'30': 'WCH',
			'31': 'WCH',
			'32': 'LET',
			'33': 'LET',
			'34': 'SOH',
			'35': 'SOH'
  }
};

// NSL (EAL) numeric station code mapping
var nslStationCodeMap = {
  '1': 'HUH',
  '2': 'MKK',
  '3': 'KOT',
  '4': 'TAW',
  '5': 'SHT',
  '6': 'FOT',
  '7': 'RAC',
  '8': 'UNI',
  '9': 'TAP',
  '10': 'TWO',
  '11': 'FAN',
  '12': 'SHS',
  '13': 'LOW',
  '14': 'LMC',
  '18': 'KTU',
  '21': 'HUH',
  '22': 'EXC',
  '23': 'ADM',
  '24': 'ADM Siding',
  '91': 'HTD',
  '92': 'HTD',
  '81': 'TEST',
  '82': 'TEST'
};

var nslOriginMap = { 
  'A': 'SHT', 
  'B': 'LMC', 
  'C': 'FOT', 
  'D': 'TAP', 
  'E': 'MKK', 
  'G': 'TAP', 
  'H': 'SHS', 
  /*'J': 'ADM', */
  'K': 'SHS', 
  'L': 'LMC', 
  'M': 'LOW', 
  'N': 'LOW', 
  'R': 'RAC', 
  'Y': 'HUH' 
};

var nslTermini = ['LOW', 'LMC', 'ADM'];

var tmlStationCodeMap = {
  '1': 'HUH',
  '14': 'ETS',
  '21': 'TAW',
  '22': 'CKT',
  '23': 'STW',
  '24': 'CIO',
  '25': 'SHM',
  '26': 'TSH',
  '27': 'HEO',
  '28': 'MOS',
  '29': 'WKS',
  '41': 'NAC',
  '42': 'MEF',
  '43': 'TWW',
  '44': 'KSR',
  '45': 'YUL',
  '46': 'LOP',
  '47': 'TIS',
  '48': 'SIH',
  '49': 'TUM',
  '50': 'AUS',
  '61': 'HOM',
  '62': 'TKW',
  '63': 'SUW',
  '64': 'KAT',
  '65': 'DIH',
  '66': 'HIK',
  '80': 'DEP',
  '91': 'DEP',
  '92': 'OUT',
  '93': 'SPC',
  '94': 'TES',
  '95': 'WR',
  '97': 'MOL'
};

// TML station order for direction calculation (higher number = toward TUM/upline)
var tmlStationOrder = {
  '29': 1,   // WKS
  '28': 2,   // MOS
  '27': 3,   // HEO
  '26': 4,   // TSH
  '25': 5,   // SHM
  '24': 6,   // CIO
  '23': 7,   // STW
  '22': 8,   // CKT
  '21': 9,   // TAW
  '66': 10,  // HIK
  '65': 11,  // DIH
  '64': 12,  // KAT
  '63': 13,  // SUW
  '62': 14,  // TKW
  '61': 15,  // HOM
  '1':  16,  // HUH
  '14': 17,  // ETS
  '50': 18,  // AUS
  '41': 19,  // NAC
  '42': 20,  // MEF
  '43': 21,  // TWW
  '44': 22,  // KSR
  '45': 23,  // YUL
  '46': 24,  // LOP
  '47': 25,  // TIS
  '48': 26,  // SIH
  '49': 27   // TUM
};

// Platform groups: stations where platforms share same destinations
// Format: { STATION_CODE: [[platformGroup_1], [platformGroup_2], ...] }
var platformGroup = {
    "LOW": [[1, 4], [2, 3]],
    "LMC": [[1, 2]],
    "TAP": [[1, 2], [3, 4]],
    "FOT": [[1, 2], [3, 4]],
    "SHT": [[1, 2], [3, 4]],
    "ADM": [[5, 6]],
    "MKK": [[1, 2]],
    "WKS": [[1, 2]],
    "TUM": [[1, 2]],
    "CEN": [[1, 2]],
    "CHW": [[1, 2]],
    "LHP": [[1, 2]],
    "HOK": [[1, 2]],
    "TUC": [[1, 2]],
    "CHH": [[1, 2], [3, 4]]
};

// ============================================
// Per-line API configuration
// Each entry defines how to call the ETA API for a specific line.
// Fields:
//   url            — Full API endpoint URL
//   method         — HTTP method: "GET" or "POST"
//   x_api_key    — API key for authentication (if required)
// ============================================
var lineApiConfig = {
  //            url                                                                                        method            x_api_key
  "KTL": { url: "https://3nx7c25ob6.execute-api.ap-east-1.amazonaws.com/trainLoads",               json_type: "url", x_api_key: null },
  "TWL": { url: "https://hrbt75qk60.execute-api.ap-east-1.amazonaws.com/default/trainLoads",       json_type: "url", x_api_key: "cWEnQqRK0taxxMVCMpNHK3kqQgcTB28tv3lPJRvb" },
  "ISL": { url: "https://sdz2h3zx17.execute-api.ap-east-1.amazonaws.com/default/trainLoads",       json_type: "url", x_api_key: "gRSyLCpSg97wxGIAhaovD4bN0fY4Z0jYa5xeoEn9" },
  "TKL": { url: "https://ylvae4pn4e.execute-api.ap-east-1.amazonaws.com/default/trainLoads",       json_type: "url", x_api_key: "N6lAPnCJUt5nVFX1vNUHm7yGBqXtJiqP6xfndhu6" },
  "SIL": { url: "https://az2yevl2wc.execute-api.ap-east-1.amazonaws.com/trainLoads",               json_type: "sil", x_api_key: null },
  "TCL": { url: "https://mtr-tcl-trainload-api.rocteccloud.com/api/trainLoads",                    json_type: "tcl", x_api_key: "LqKX1iHtfm3hFNCluSUlp6FoSAjjF6Nm5ZrMy5av" },
  "EAL": { url: "https://d30c8uozaghdca.cloudfront.net",                                           json_type: "nsl", x_api_key: "QkmjCRYvXt6o89UdZAvoXa49543NxOtU2tBhQQDQ" },
  "TML": { url: "https://8e304x2wjg.execute-api.ap-east-1.amazonaws.com/test/obcs-data-exchanges", json_type: "tml", x_api_key: "QkmjCRYvXt6o89UdZAvoXa49543NxOtU2tBhQQDQ" }
};

// Lines with confirmed train type support
var TRAINTYPE_SUPPORTED_LINES = ["KTL", "TWL", "ISL", "TKL", "TCL", "TML", "EAL", "SIL"];

var openDataLines = ["DRL"];

// Special Train List: Show origin for specific trains
// Fields: td, origin_station_code, departure_time, operating_days (1=Mon, 2=Tue, ..., 7=Sun)
var specialTrains = {
  "KTL": {
    "up": [
      { "td": "40", "origin_station_code": "NTK", "departure_time": "15:56", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "42", "origin_station_code": "NTK", "departure_time": "16:10", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "35", "origin_station_code": "NTK", "departure_time": "16:32", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "36", "origin_station_code": "NTK", "departure_time": "16:39", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "37", "origin_station_code": "NTK", "departure_time": "16:46", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "38", "origin_station_code": "NTK", "departure_time": "16:53", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "39", "origin_station_code": "NTK", "departure_time": "16:57", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "41", "origin_station_code": "NTK", "departure_time": "17:14", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "44", "origin_station_code": "NTK", "departure_time": "17:27", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "19", "origin_station_code": "NTK", "departure_time": "11:44", "operating_days": [6] },
      { "td": "24", "origin_station_code": "NTK", "departure_time": "11:57", "operating_days": [6] },
      { "td": "01", "origin_station_code": "NTK", "departure_time": "12:09", "operating_days": [6] },
      { "td": "06", "origin_station_code": "NTK", "departure_time": "12:21", "operating_days": [6] },
      { "td": "12", "origin_station_code": "NTK", "departure_time": "12:37", "operating_days": [6] },
      { "td": "02", "origin_station_code": "NTK", "departure_time": "08:31", "operating_days": [7] },
      { "td": "05", "origin_station_code": "NTK", "departure_time": "08:41", "operating_days": [7] },
      { "td": "07", "origin_station_code": "NTK", "departure_time": "08:46", "operating_days": [7] },
      { "td": "10", "origin_station_code": "NTK", "departure_time": "08:56", "operating_days": [7] },
      { "td": "13", "origin_station_code": "NTK", "departure_time": "09:06", "operating_days": [7] },
      { "td": "15", "origin_station_code": "NTK", "departure_time": "09:11", "operating_days": [7] },
      { "td": "18", "origin_station_code": "NTK", "departure_time": "09:21", "operating_days": [7] },
      { "td": "20", "origin_station_code": "NTK", "departure_time": "09:26", "operating_days": [7] },
      { "td": "23", "origin_station_code": "NTK", "departure_time": "09:36", "operating_days": [7] },
      { "td": "44", "origin_station_code": "PRE", "departure_time": "18:23", "operating_days": [1, 2, 3, 4, 5] }
    ],
    "down": [
      { "td": "45", "origin_station_code": "CHH", "departure_time": "16:47", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "46", "origin_station_code": "CHH", "departure_time": "16:56", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "43", "origin_station_code": "CHH", "departure_time": "17:50", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "32", "origin_station_code": "DIH", "departure_time": "08:21", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "08", "origin_station_code": "NTK", "departure_time": "18:30", "operating_days": [1, 2, 3, 4, 5] }
    ]
  },
  "ISL": {
    "up": [
      { "td": "36", "origin_station_code": "ADM", "departure_time": "18:33", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "20", "origin_station_code": "CEN", "departure_time": "18:41", "operating_days": [1, 2, 3, 4, 5] }
    ],
    "down": [
      { "td": "28", "origin_station_code": "NOP", "departure_time": "08:28", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "30", "origin_station_code": "NOP", "departure_time": "08:35", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "33", "origin_station_code": "NOP", "departure_time": "08:44", "operating_days": [1, 2, 3, 4, 5] }
    ]
  },
  "TKL": {
    "up": [],
    "down": [
      { "td": "22", "origin_station_code": "TKO", "departure_time": "07:08", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "37", "origin_station_code": "TKO", "departure_time": "16:18", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "38", "origin_station_code": "TKO", "departure_time": "16:27", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "39", "origin_station_code": "TKO", "departure_time": "16:35", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "40", "origin_station_code": "TKO", "departure_time": "16:39", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "41", "origin_station_code": "TKO", "departure_time": "16:45", "operating_days": [1, 2, 3, 4, 5] }
    ]
  },
  "TML": {
    "up": [{ "td": "12", "origin_station_code": "KSR", "departure_time": "06:03", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "13", "origin_station_code": "KSR", "departure_time": "06:09", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "45", "origin_station_code": "KSR", "departure_time": "06:23", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "41", "origin_station_code": "KSR", "departure_time": "06:26", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "46", "origin_station_code": "KSR", "departure_time": "06:32", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "17", "origin_station_code": "KSR", "departure_time": "06:35", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "47", "origin_station_code": "KSR", "departure_time": "06:41", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "19", "origin_station_code": "KSR", "departure_time": "06:44", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "32", "origin_station_code": "KSR", "departure_time": "06:50", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "24", "origin_station_code": "KSR", "departure_time": "06:56", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "33", "origin_station_code": "KSR", "departure_time": "07:02", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "25", "origin_station_code": "KSR", "departure_time": "07:09", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "34", "origin_station_code": "KSR", "departure_time": "07:16", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "01", "origin_station_code": "KSR", "departure_time": "07:24", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "14", "origin_station_code": "HUH", "departure_time": "05:53", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "15", "origin_station_code": "HUH", "departure_time": "05:58", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "35", "origin_station_code": "ETS", "departure_time": "07:02", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "06", "origin_station_code": "CIO", "departure_time": "07:14", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "28", "origin_station_code": "CIO", "departure_time": "07:20", "operating_days": [1, 2, 3, 4, 5] },

      { "td": "64", "origin_station_code": "KSR", "departure_time": "16:26", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "65", "origin_station_code": "KSR", "departure_time": "16:43", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "66", "origin_station_code": "KSR", "departure_time": "16:49", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "67", "origin_station_code": "KSR", "departure_time": "16:56", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "68", "origin_station_code": "ETS", "departure_time": "16:43", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "69", "origin_station_code": "ETS", "departure_time": "16:50", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "70", "origin_station_code": "ETS", "departure_time": "16:57", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "71", "origin_station_code": "ETS", "departure_time": "17:04", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "74", "origin_station_code": "ETS", "departure_time": "18:30", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "72", "origin_station_code": "HOM", "departure_time": "17:07", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "73", "origin_station_code": "HOM", "departure_time": "17:14", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "75", "origin_station_code": "NAC", "departure_time": "18:44", "operating_days": [1, 2, 3, 4, 5] }
    ],
    "down": [
      { "td": "21", "origin_station_code": "TAW", "departure_time": "05:40", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "22", "origin_station_code": "TAW", "departure_time": "05:47", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "23", "origin_station_code": "TAW", "departure_time": "05:54", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "36", "origin_station_code": "TAW", "departure_time": "06:01", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "29", "origin_station_code": "TAW", "departure_time": "06:08", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "37", "origin_station_code": "TAW", "departure_time": "06:14", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "04", "origin_station_code": "ETS", "departure_time": "06:01", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "05", "origin_station_code": "ETS", "departure_time": "06:07", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "27", "origin_station_code": "ETS", "departure_time": "06:14", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "30", "origin_station_code": "TWW", "departure_time": "06:23", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "10", "origin_station_code": "TWW", "departure_time": "06:31", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "39", "origin_station_code": "TWW", "departure_time": "06:37", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "40", "origin_station_code": "TWW", "departure_time": "06:43", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "49", "origin_station_code": "TWW", "departure_time": "06:50", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "44", "origin_station_code": "TWW", "departure_time": "06:56", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "51", "origin_station_code": "TIS", "departure_time": "08:09", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "52", "origin_station_code": "TIS", "departure_time": "08:19", "operating_days": [1, 2, 3, 4, 5] },

      { "td": "53", "origin_station_code": "TAW", "departure_time": "16:23", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "54", "origin_station_code": "TAW", "departure_time": "16:31", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "55", "origin_station_code": "TAW", "departure_time": "16:38", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "56", "origin_station_code": "TAW", "departure_time": "16:45", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "57", "origin_station_code": "TAW", "departure_time": "16:52", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "58", "origin_station_code": "TWW", "departure_time": "16:25", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "59", "origin_station_code": "TWW", "departure_time": "16:32", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "60", "origin_station_code": "TWW", "departure_time": "16:39", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "61", "origin_station_code": "TWW", "departure_time": "16:46", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "62", "origin_station_code": "TWW", "departure_time": "16:53", "operating_days": [1, 2, 3, 4, 5] },
      { "td": "63", "origin_station_code": "TWW", "departure_time": "17:00", "operating_days": [1, 2, 3, 4, 5] }
    ]
  }
};

var linesOperationData = {
  "KTL": { "journey_time": 34 },
  "TWL": { "journey_time": 33 },
  "ISL": { "journey_time": 33 },
  "TKL": { "journey_time": 17 },
  "SIL": { "journey_time": 12 },
  "TCL": { "journey_time": 31 },
  "AEL": { "journey_time": 29 },
  "DRL": { "journey_time": 4 },
  "EAL": { "journey_time": 50 },
  "TML": { "journey_time": 74 }
};