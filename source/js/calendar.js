(function () {
  'use strict';

  function initCalendar() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var date = now.getDate();
    var week = now.getDay();
    var isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    var monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var dates = monthDays[month];
    var weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    /* Week number (approx) */
    var startOfYear = new Date(year, 0, 1);
    var weekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);

    /* ---- Calendar card ---- */
    var calEl = document.getElementById('card-widget-calendar');
    if (calEl) {
      calEl.querySelector('#calendar-week').textContent = weekNames[week];
      calEl.querySelector('#calendar-date').textContent = String(date).padStart(2, '0');
      calEl.querySelector('#calendar-solar').textContent = year + '年 ' + monthNames[month] + ' 第' + (Math.floor((now - startOfYear) / 86400000) + 1) + '天';

      /* Lunar */
      var lunarStr = '';
      if (typeof chineseLunar !== 'undefined') {
        var lunarDate = chineseLunar.solarToLunar(now);
        var ganzhi = chineseLunar.format(lunarDate, 'T').slice(0, -1);
        var animal = chineseLunar.format(lunarDate, 'A');
        var lunarMon = chineseLunar.format(lunarDate, 'M');
        var lunarDay = chineseLunar.format(lunarDate, 'd');
        lunarStr = ganzhi + animal + '年 ' + lunarMon + lunarDay;
      }
      calEl.querySelector('#calendar-lunar').textContent = lunarStr;

      /* Calendar grid */
      var grid = calEl.querySelector('#calendar-main');
      var startDay = new Date(year, month, 1).getDay();
      var rows = Math.ceil((startDay + dates) / 7);

      /* Remove old rows (keep header .calendar-rh) */
      var oldRows = grid.querySelectorAll('.calendar-r0, .calendar-r1, .calendar-r2, .calendar-r3, .calendar-r4, .calendar-r5');
      oldRows.forEach(function (el) { el.remove(); });

      var day = 1;
      for (var r = 0; r < rows; r++) {
        var row = document.createElement('div');
        row.className = 'calendar-r' + r;
        for (var c = 0; c < 7; c++) {
          var cell = document.createElement('div');
          cell.className = 'calendar-d' + c;
          if ((r === 0 && c < startDay) || day > dates) {
            cell.innerHTML = '<a></a>';
          } else {
            var isNow = day === date;
            cell.innerHTML = '<a' + (isNow ? ' class="now"' : '') + '>' + day + '</a>';
            day++;
          }
          row.appendChild(cell);
        }
        grid.appendChild(row);
      }

      /* Adjust date font size */
      var dateEl = calEl.querySelector('#calendar-date');
      if (rows > 5) dateEl.style.fontSize = '48px';
      else dateEl.style.fontSize = '64px';
    }

    /* ---- Schedule card ---- */
    var schedEl = document.getElementById('card-widget-schedule');
    if (schedEl) {
      /* Year progress */
      var yearElapsed = Math.floor((now - startOfYear) / 86400000);
      var yearTotal = isLeap ? 366 : 365;
      var yearPct = (yearElapsed / yearTotal * 100).toFixed(1);
      schedEl.querySelector('#pBar_year').value = yearElapsed;
      schedEl.querySelector('#p_span_year').textContent = yearPct + '%';
      schedEl.querySelector('#p_remaining_year').textContent = yearTotal - yearElapsed;

      /* Month progress */
      schedEl.querySelector('#pBar_month').value = date;
      schedEl.querySelector('#pBar_month').max = dates;
      var monthPct = (date / dates * 100).toFixed(1);
      schedEl.querySelector('#p_span_month').textContent = monthPct + '%';
      schedEl.querySelector('#p_remaining_month').textContent = dates - date;

      /* Week progress */
      var weekDay = week === 0 ? 7 : week;
      var weekPct = (weekDay / 7 * 100).toFixed(1);
      schedEl.querySelector('#pBar_week').value = weekDay;
      schedEl.querySelector('#p_span_week').textContent = weekPct + '%';
      schedEl.querySelector('#p_remaining_week').textContent = 7 - weekDay;

      /* Chinese New Year countdown (auto-detect via lunar library) */
      var cnyDate = null;
      if (typeof chineseLunar !== 'undefined' && typeof chineseLunar.lunarToSolar === 'function') {
        /* Try current year + 1 for 正月初一, then fallback */
        for (var gy = year + 1; gy <= year + 2; gy++) {
          var tryDate = chineseLunar.lunarToSolar(gy, 1, 1);
          if (tryDate && tryDate instanceof Date && !isNaN(tryDate.getTime())) {
            if (tryDate > now) {
              cnyDate = tryDate;
              break;
            }
          }
        }
      }
      /* Fallback: lookup table for known CNY dates */
      if (!cnyDate) {
        var cnyTable = {};
        cnyTable[2025] = new Date(2025, 0, 29);
        cnyTable[2026] = new Date(2026, 1, 17);
        cnyTable[2027] = new Date(2027, 1, 6);
        cnyTable[2028] = new Date(2028, 0, 26);
        cnyTable[2029] = new Date(2029, 1, 13);
        cnyTable[2030] = new Date(2030, 1, 3);
        cnyTable[2031] = new Date(2031, 0, 23);
        cnyTable[2032] = new Date(2032, 1, 11);
        cnyTable[2033] = new Date(2033, 0, 31);
        cnyTable[2034] = new Date(2034, 1, 19);
        cnyTable[2035] = new Date(2035, 1, 8);
        for (var y = year; y <= year + 2; y++) {
          if (cnyTable[y] && cnyTable[y] > now) {
            cnyDate = cnyTable[y];
            break;
          }
        }
      }
      if (cnyDate) {
        /* 除夕 = 正月初一前1天 */
        var nyeDate = new Date(cnyDate.getTime() - 86400000);
        var daysUntil = Math.ceil((nyeDate - now) / 86400000);
        if (daysUntil < 0) daysUntil = 0;
        schedEl.querySelector('#schedule-days').textContent = daysUntil;
        schedEl.querySelector('#schedule-countdown-date').textContent = nyeDate.getFullYear() + '-' + String(nyeDate.getMonth() + 1).padStart(2, '0') + '-' + String(nyeDate.getDate()).padStart(2, '0');
      } else {
        schedEl.querySelector('#schedule-days').textContent = '--';
      }
    }
  }

  /* Boot */
  function boot() {
    if (document.getElementById('card-widget-calendar') || document.getElementById('card-widget-schedule')) {
      initCalendar();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('pjax:complete', boot);
}());
