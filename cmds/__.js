/* 
 * Copyright © 2025 Mysterioh
 * This file is part of Sword Bot and is licensed under the GNU GPLv3.
 * And I hope you know what you're doing here.
 * You may not use this file except in compliance with the License.
 * See the LICENSE file or https://www.gnu.org/licenses/gpl-3.0.html
 * -------------------------------------------------------------------------------
 */

const os = require("os")
const { changeFont } = require("../core")
const { prefix, sword, wtype, secondsToHms, config, commands } = require("../core")
const { version } = require("../package.json")

const format = (bytes) => {
  const sizes = ["B", "KB", "MB", "GB"]
  if (bytes === 0) return "0 B"
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + " " + sizes[i]
}

function clockString(ms) {
  let h = isNaN(ms) ? "--" : Math.floor(ms / 3600000)
  let m = isNaN(ms) ? "--" : Math.floor(ms % 3600000 / 60000)
  let s = isNaN(ms) ? "--" : Math.floor(ms % 60000 / 1000)
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(":")
}

const getRamBar = () => {
  const totalMem = os.totalmem()
  const usedMem = totalMem - os.freemem()
  const usagePercent = (usedMem / totalMem) * 100
  
  const filledBlocks = Math.round(usagePercent / 10)
  const emptyBlocks = 10 - filledBlocks
  
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks)
  
  return {
    bar: `[${bar}]`,
    percent: Math.round(usagePercent),
    used: format(usedMem),
    total: format(totalMem)
  }
}

sword({
  cmd: "menu|help",
  desc: "list of commands",
  react: "💬",
  fromMe: wtype,
  type: "help",
}, async (m) => {
  try {
    const types = {}
    commands.forEach(({ cmd, type }) => {
      if (!cmd) return
      const main = cmd.split("|")[0].trim()
      const cat = type || "other"
      if (!types[cat]) types[cat] = []
      types[cat].push(main)
    })

    const requestedType = m.text ? m.text.toLowerCase().trim() : null
    const availableTypes = Object.keys(types).map(t => t.toLowerCase())
    
    if (requestedType && availableTypes.includes(requestedType)) {
      const actualType = Object.keys(types).find(t => t.toLowerCase() === requestedType)
      
      let menu = `┏▣ ◈ *${actualType.toUpperCase()} MENU* ◈\n`
      types[actualType].forEach(cmd => {
        menu += `│➽ ${prefix}${cmd.replace(/[^a-zA-Z0-9-+]/g, "")}\n`
      })
      menu += `┗▣ \n\n_Tip: Use ${prefix}menu to see all categories_`
      
      return m.send(menu)
    }
    
    const date = new Date().toLocaleDateString()
    const time = new Date().toLocaleTimeString()
    const uptime = await secondsToHms(process.uptime())
    const memoryUsage = format(os.totalmem() - os.freemem())
    const totalMemory = format(os.totalmem())
    
    const ramInfo = getRamBar()
    
    const botMode = config().WORKTYPE || "public"
    
    let menu = `┏▣ ◈ *${config().BOT_NAME}* ◈
┃ *ᴏᴡɴᴇʀ* : ${config().OWNER_NAME}
┃ *ᴘʀᴇғɪx* : [ ${prefix} ]
┃ *ʜᴏsᴛ* : ${m.client.platform()}
┃ *ᴘʟᴜɢɪɴs* : ${commands.length}
┃ *ᴍᴏᴅᴇ* : ${botMode.toUpperCase()}
┃ *ᴠᴇʀsɪᴏɴ* : v${version}
┃ *ᴜᴘᴛɪᴍᴇ* : ${uptime}
┃ *ᴜsᴀɢᴇ* : ${ramInfo.used} of ${ramInfo.total}
┃ *ʀᴀᴍ:* ${ramInfo.bar} ${ramInfo.percent}%
┗▣ \n\n`

    Object.keys(types).forEach(type => {
      menu += `┏▣ ◈ *${type.toUpperCase()} MENU* ◈\n`
      types[type].forEach(cmd => {
        menu += `│➽ ${prefix}${cmd.replace(/[^a-zA-Z0-9-+]/g, "")}\n`
      })
      menu += `┗▣ \n\n`
    })

    menu += `_Tip: Use ${prefix}menu [category] for specific commands_`

    try {
      if (config().MENU_IMAGE)
        return m.send(config().MENU_IMAGE, { caption: menu }, "image")
    } catch (e) {}

    return m.send(menu)
  } catch (e) {
    console.log("cmd error", e)
    return await m.sendErr(e)
  }
})
