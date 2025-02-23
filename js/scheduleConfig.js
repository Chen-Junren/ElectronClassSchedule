﻿/*
 * Copyright (c) 2025. Chen Junren. All rights reserved.
 * This software is the proprietary information of Chen Junren.
 * Unauthorized use, reproduction, or distribution of this software
 * without prior written permission is strictly prohibited.
 * For authorized use, the following license applies: GNU GPL v3.0
 * For the full GPL license, read the LINCENSE file.
 * THIS SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,  ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const _scheduleConfig = {

    // 倒计时目标：位于右侧框中的倒计时，输入日期即可，可以是中考高考期末等等，格式YYYY-MM-DD
    // 若想隐藏右侧的倒计时，请在下方冒号后填入'hidden', (包括引号)
    countdown_target: '2025-6-17',

    // 星期显示：左侧框是否显示，显示为true，隐藏为false
    // 直接将true或false填入冒号后边，没有引号
    week_display: true,

    // 科目名称：所有课程科目的简写及其对应全称，冒号前面(key)为简写，后面(value)为全称，不限字数，
    // 若存在多个课程简写相同，需要加以区分，可以为简写添加下角标，使用@分隔，如'自@语'，@前为简写，@后为下角标
    // 要求必须做到覆盖完全，否则可能会保错
    subject_name: {
        '延@语': '语文延时',
        '延@数': '数学延时',
        '延@英': '英语延时',
        '延@物': '物理延时',
        '延@化': '化学延时',
        '延@史': '历史延时',
        '延@政': '政治延时',
        '自': '自习',
        '物': '物理',
        '英': '英语',
        '化': '化学',
        '语': '语文',
        '数': '数学',
        '史': '历史',
        '政': '政治',
        '班': '班会',
        '音':'音乐',
        '美':'美术',
        '体':'体育'
    },

    //<editor-fold desc="Description">
    // 时间表: 每天课程安排的时间表，内层冒号前面为时间，后面为课程序号(从0开始的数字[不带'']) 或 课间具体名称(用''包裹中间写文字)
    // 这里的例子workday和weekend（外层）只是举例，你也可以自定义其名字(第一个字符不要为数字)
    // 比如如果你的学校周三半天，你可以在这里单独添加一个wednesday: {...}
    // 注：时间段中-后的时间要减一分钟 比如某节课40分钟，时间段为08:00-08:40，但实际配置时要配置'08:00-08:39'
    //</editor-fold>
    timetable: {
        Mon: {
            '07:30-07:59':0,
            '08:00-08:39':1,
            '08:40-08:54':'课间',
            '08:55-09:34':2,
            '09:35-10:24':'升旗&出操',
            '10:25-11:04':3,
            '11:05-11:19':'课间',
            '11:20-11:59':4,
            '12:00-12:54':'午休&自习',
            '12:55-12:59':'课间',
            '13:00-13:39':5,
            '13:40-13:54':'课间',
            '13:55-14:34':6,
            '14:35-14:49':'课间',
            '14:50-15:29':7,
            '15:30-15:34':'课间',
            '15:35-16:19':8,
            '16:20-17:04':9,
            '17:05-17:44':10,
            '17:45-17:59':'放学'
        },
        Oth: {
            '07:39-08:19':0,
            '08:20-08:34':'课间',
            '08:35-09:14':1,
            '09:15-09:29':'课间',
            '09:30-10:09':2,
            '10:10-10:24':'课间',
            '10:25-11:04':3,
            '11:05-11:19':'课间',
            '11:20-11:59':4,
            '12:00-12:54':'午休&自习',
            '12:55-12:59':'课间',
            '13:00-13:39':5,
            '13:40-13:54':'课间',
            '13:55-14:34':6,
            '14:35-14:49':'课间',
            '14:50-15:29':7,
            '15:30-15:34':'课间',
            '15:35-16:44':8,
            '16:45-17:44':9,
		    '17:45-17:59':'放学'
        },
        Fri: {
            '07:39-08:19':0,
            '08:20-08:34':'课间',
            '08:35-09:14':1,
            '09:15-09:29':'课间',
            '09:30-10:09':2,
            '10:10-10:24':'课间',
            '10:25-11:04':3,
            '11:05-11:19':'课间',
            '11:20-11:59':4,
            '12:00-12:54':'午休&自习',
            '12:55-12：59':'课间',
            '13:00-13:39':5,
            '13:40-13:54':'课间',
            '13:55-14:34':6,
            '14:35-14:49':'课间',
            '14:50-15:29':7,
            '15:30-15:34':'课间',
            '15:35-15:44':8,
            '15:35-16:44':9,
            '16:45-17:44':10,
		    '17:45-17:59':'放学'
        }
    },

    // 分隔线: 课表中区分不同时段课程的分隔线配置，外层key（冒号前）部分与上面timetable相同
    // value（冒号后）为分隔线所在位置的前一个课程序号(从0开始的数字[不带''])
    divider: {
        Mon: [4, 7],
        Oth: [4, 7],
        Fri: [4, 7]

    },

    // 每日课程：配置星期几对应第几堂课是什么课，星期顺序不可以更改(星期日/一/二/三/四/五/六)，你可以对classList后面内容进行更改
    // 从classList后最外的中括号看起，里面的第几个元素的序号-1就是该元素的下标，这个下标对应你在上面timetable中配置的数字，课程用单引号包含，写入在subject_name中配置的简写
    // 如果该节课可能存在每周轮换，你可以用一个中括号把他们全部写进去如: ['(第一周课)物', '(第二周)化', '(第三周)地', '(第四周)数'](小括号及其内容无需填写, 最多支持四周轮换)
    // 下面的timetable中配置该日属于在上面的timetable中的哪一类，如周日属于weekend就这样写 timetable: 'weekend'，用单引号包含
    daily_class: [
      {
          Chinese: '日',
          English: 'SUN',
          classList: ['','','','','','',''],
          timetable: 'Oth'
      },
        {
            Chinese: '一',
            English: 'MON',
            classList: [['英','语'],'物','数','英','语','道','化','历','自','延@物','延@化'],
            timetable: 'Mon'
        },
        {
            Chinese: '二',
            English: 'TUE',
            classList: ['','体','英','数','化','史','物','英','自','延@数'],
            timetable: 'Oth'
        },
        {
            Chinese: '三',
            English: 'WED',
            classList: ['语','英','化','数','物',['美','音'],'数','政','自','延@英'],
            timetable: 'Oth'
        },
        {
            Chinese: '四',
            English: 'THR',
            classList: ['英','体','数','物','语','英','化','政','自','延@语'],
            timetable: 'Oth'
        },
        {
            Chinese: '五',
            English: 'FRI',
            classList: ['语','化','数','英','史','体','物','班','延@数','自',['延@政','延@史']],
            timetable: 'Fri'
        },
       {
            Chinese: '六',
            English: 'SAT',
            classList: ['','','','','','',''],
            timetable: 'Oth'
        },
      
    ],


    // 课表样式: 配置课表样式CSS变量, 包括字体大小，透明度等属性
    // 请不要更改冒号前半部分文字, 请更改冒号后单引号中的数字(切勿删除引号与数字后的单位), 如果你对CSS有所了解你也可以尝试更改CSS单位
    css_style: {
        '--center-font-size': '50px', // 中间课表中的课程简写单字的字体大小
        '--days-font-size':'44px', // 左侧的星期中文名的字体大小+右侧的"距离'...'还有"显示字的字体大小
        '--corner-font-size': '14px', // 左侧的星期中文角标与右侧的"天"字的字体大小
        '--countdown-font-size': '28px', // 课程或课间的全称与倒计时的字体大小
        '--global-border-radius': '16px', // 所有背景框的圆角大小
        '--global-bg-opacity': '0.4', // 所有背景框的不透明度, 范围: [0, 1]
        '--container-bg-padding': '8px 14px', // 上面三个框各自的背景内边距, 前面的数字表示纵向边距，后面的数字表示横向边距
        '--countdown-bg-padding': '5px 12px', // 倒计时框的背景内边距, 前面的数字表示纵向边距，后面的数字表示横向边距
        '--container-space': '16px', // 上面三个框中间的间隔长度
        '--top-space': '16px', // 课表主体最顶端与电脑屏幕上边框的间隔长度
        '--main-horizontal-space': '8px', // 中间课表中的课程简写单字之间的间隔长度
        '--divider-width': '2px', // 分隔线宽度
        '--divider-margin': '6px', // 分隔线外边距
        '--triangle-size': '16px', // 倒计时框上方小三角箭头的大小
        '--sub-font-size': '20px', // 中间课表中的课程下角标(X@X)的字体大小
    }
}

let scheduleConfig = JSON.parse(JSON.stringify(_scheduleConfig))
