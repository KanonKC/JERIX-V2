const {Client,Intents,MessageButton,MessageActionRow, MessageEmbed} = require('discord.js')
const { addHomework, getAllHomeworks, createFile, openFile, getAllFiles, deleteHomework, editHomework, editChannel } = require('../services/homeworklist.service')

const TypeIcon = {
    ASSIGNMENT: "📝",
    ALERT: "🔔",
    EXAM: "🔥"
}

class Homework{
    constructor(homework){
        this.id = homework.homework_id
        this.is_active = homework.is_active
        this.date = homework.date
        this.month = homework.month
        this.year = homework.year
        this.timestamp = homework.timestamp*1000
        this.day_name = homework.day_name.slice(0,3)
        this.type = homework.type
        this.label = homework.label
        
        this.day_left = Math.floor((this.timestamp-Date.now())/86400000)

        this.type_icon = TypeIcon[homework.type]
        this.alert_icon = "⚫"
        if(this.day_left <= 2){this.alert_icon = "⭕"}
        else if(this.day_left <= 5){this.alert_icon = "🟡"}
        else if(this.day_left <= 7){this.alert_icon = "🔵"}
    }
}

function fixSpace(text,n,space=' '){
    let res = String(text)
    while(res.length < n){
        res = space + res
    }
    return res
}

function getYear(d,m){
    const currentYear = Number(String(new Date()).split(' ')[3])
    const duets = new Date(currentYear,m-1,d,23,59,59).getTime()
    const nowts = Date.now()
    if(duets <= nowts){
        return currentYear+1
    }
    return currentYear
}

const Homeworklist = {
    Title: ':bookmark: **Homeworklist 3.1**',
    Button: new MessageActionRow().addComponents(
        new MessageButton().setLabel("📋 All").setStyle("SECONDARY").setCustomId("homeworklist-Type-ALL"),
        new MessageButton().setLabel("📝 Assignment").setStyle("PRIMARY").setCustomId("homeworklist-Type-Assignment"),
        new MessageButton().setLabel("🔔 Alert").setStyle("SUCCESS").setCustomId("homeworklist-Type-Alert"),
        new MessageButton().setLabel("🔥 Exam").setStyle("DANGER").setCustomId("homeworklist-Type-Exam")
    ),
    EmptyListMessage: "*-------------------------- EMPTY --------------------------*",
    File: (instance,count) => {
        return `\`\`\`📁 File: ${instance.filename} (${count})\`\`\``
    },
    Card: (instance) => {
        const hw = new Homework(instance)
        return `[\`${hw.day_name}\`.\`${fixSpace(hw.date,2,'0')}/${fixSpace(hw.month,2,'0')}\`] ${hw.alert_icon} (\`${fixSpace(hw.day_left,3)}\` วัน) ${hw.type_icon} \`[${fixSpace(hw.id,4,'0')}]\` \`${hw.label}\``
    },
    list: async (channelId,type='ALL') => {
        type = type.toUpperCase()
        var { status,data } = await getAllHomeworks(channelId)
        if(status >= 400){
            return Homeworklist.DisplayBox("❌ This channel has not opened any File yet")
        }
        data.homeworks = data.homeworks.filter(homework => homework.timestamp*1000 >= Date.now())
        var total_length = data.homeworks.length
        if(type !== 'ALL'){
            data.homeworks = data.homeworks.filter(homework => homework.type === type)
        }
        var filtered_length = data.homeworks.length
        var result = data.homeworks.map(homework => Homeworklist.Card(homework))
        if(type !== 'ALL'){
            return {content: `${Homeworklist.Title}\n\`\`\`📁 File: ${data.file.filename} (${total_length}) >> ${TypeIcon[type]} ${type} (${filtered_length})\`\`\`${filtered_length == 0 ? Homeworklist.EmptyListMessage : result.join('\n')}`,components: [Homeworklist.Button]}
        }
        else{
            return {content: `${Homeworklist.Title}\n${Homeworklist.File(data.file,result.length)}${result.length == 0 ? Homeworklist.EmptyListMessage : result.join('\n')}`,components: [Homeworklist.Button]}
        }
    },
    OpenFile: {
        File: (count) => {
            return `\`\`\`📁 Files (${count})\`\`\``
        },
        Card: (instance,isCurrent) => {
            return `${isCurrent ? ':pushpin:' : ':file_folder:'} \`[${fixSpace(instance.file_id,4,'0')}]\` \`${instance.filename}\``
        },
        ButtonSelector: (files,current_file_id) => {
            var buttons = files.slice(0,5).map(file => 
                new MessageButton()
                .setLabel(`${file.file_id == current_file_id ? "📌":"📁"} ${file.filename}`)
                .setStyle(file.file_id == current_file_id ? "SUCCESS":"SECONDARY")
                .setDisabled(file.file_id == current_file_id)
                .setCustomId(`homeworklist-OpenFile-${file.owner_id}-${file.file_id}`)
            )
            while(buttons.length < 5){
                buttons.push(new MessageButton()
                .setLabel(`< Empty File >`)
                .setStyle("SECONDARY")
                .setDisabled(true)
                .setCustomId(`homeworklist-OpenFile-00000-empty-${buttons.length}`))
            }
            return new MessageActionRow().addComponents(...buttons)
        }
    },
    DisplayBox: (message) => {
        return {content: Homeworklist.Title,embeds:[new MessageEmbed().setDescription(message).setColor("#ffde82")]}
        return `${Homeworklist.Title}\n\`\`\`${message}\`\`\``
    }
}

module.exports = {
    name: "homework",
    alias: ['homework','hw'],
    roleRequirement: [],
    execute: async function(message,arg){
        switch(arg[1]){
            case "add": case "alert": case "exam": case "assignment":
                var format_label = arg.slice(4).join(" ")
                if(arg[1] == "add") arg[1] = "assignment"

                var d = Number(arg[2])
                var m = Number(arg[3])
                var body = {
                    date: d,
                    month: m,
                    year: getYear(d,m),
                    type: arg[1].toUpperCase(),
                    label: format_label
                }
                var { status,data } = await addHomework(message.author.id,message.channelId,body)
                if(status >= 400){
                    message.channel.send(Homeworklist.DisplayBox("🚫 You don't have permission to edit this file!"))
                }
                else{
                    message.channel.send(await Homeworklist.list(message.channelId))
                }
                break
            
            case "list":                
                message.channel.send(await Homeworklist.list(message.channelId))
                break
            
            case "delete":
                var { status } = await deleteHomework(message.author.id,message.channelId,Number(arg[2]))
                if(status >= 400){
                    message.channel.send(Homeworklist.DisplayBox("🚫 You don't have permission to edit this file!"))
                }
                else{
                    message.channel.send(await Homeworklist.list(message.channelId))
                }
                break
            
            case "edit":
                var body = {
                    date: Number(arg[3]),
                    month: Number(arg[4])
                }
                var { status } = await editHomework(message.author.id,message.channelId,Number(arg[2]),body)
                if(status >= 400){
                    message.channel.send(Homeworklist.DisplayBox("🚫 You don't have permission to edit this file!"))
                }
                else{
                    message.channel.send(await Homeworklist.list(message.channelId))
                }
                break
            
            case "editlabel":
                var body = {
                    label: arg.slice(3).join(" ")
                }
                var { status } = await editHomework(message.author.id,message.channelId,Number(arg[2]),body)
                if(status >= 400){
                    message.channel.send(Homeworklist.DisplayBox("🚫 You don't have permission to edit this file!"))
                }
                else{
                    message.channel.send(await Homeworklist.list(message.channelId))
                }
                break
            
            case "edittype":
                if(arg[3] == "add") arg[3] = "assignment"
                var body = {
                    type: arg[3].toUpperCase()
                }
                var { status } = await editHomework(message.author.id,message.channelId,Number(arg[2]),body)
                if(status >= 400){
                    message.channel.send(Homeworklist.DisplayBox("🚫 You don't have permission to edit this file!"))
                }
                else{
                    message.channel.send(await Homeworklist.list(message.channelId))
                }
                break

            case "open":
                try{
                    var target = arg[2] ? arg[2].slice(2,-1) : message.author.id
                    var { data } = await getAllHomeworks(message.channelId)
                    var current_id = data.file.file_id
                    var { data } = await getAllFiles(target)
                    var buttonRow = Homeworklist.OpenFile.ButtonSelector(data.files,current_id)
                    message.channel.send({content:`${Homeworklist.Title}\n${Homeworklist.OpenFile.File(data.files.length)}`,components: [buttonRow]})
                }
                catch(err){
                    message.channel.send(Homeworklist.DisplayBox("❌ Invalid user id!"))
                }
                break
            
            case "create":
                var body = {
                    filename: arg[2]
                }
                var { status,data } = await createFile(message.author.id,message.channelId,body)
                if(status > 400){
                    message.channel.send(Homeworklist.DisplayBox('❌ ' + data.message))
                }
                else{
                    message.channel.send(Homeworklist.DisplayBox(`✅ File successfully created! >> \`📁${data.file.filename}\``))
                }
                break
            
            case "noti":
            case "notification":
                var body = {
                    enable_notification: arg[2] == "on"
                }
                var { data } = await editChannel(message.author.id,message.channelId,body)
                console.log(data)
                if(data.enable_notification){
                    message.channel.send(Homeworklist.DisplayBox(`🔔 Turn on notification on <#${data.channel_id}>`))
                }
                else{
                    message.channel.send(Homeworklist.DisplayBox(`🔕 Turn off notification on <#${data.channel_id}>`))
                }
                break

            case "canedit":
                var body = {
                    can_edit: arg[2] == "on"
                }
                var { status,data } = await editChannel(message.author.id,message.channelId,body)
                if(status >= 400){
                    message.channel.send(Homeworklist.DisplayBox("🚫 You don't have permission to edit this file!"))
                }
                else{
                    if(data.can_edit){
                        message.channel.send(Homeworklist.DisplayBox('🔓 Anyone in this channel can edit this File'))
                    }
                    else{
                        message.channel.send(Homeworklist.DisplayBox('🔒 Only owner can edit this File'))
                    }
                }
        }
        return 0
    },
    list: (channelId,type) => Homeworklist.list(channelId,type),
    ReCreateButtonSelector: async (discord_id,channel_id) => {
        var { data } = await getAllHomeworks(channel_id)
        var current_id = data.file.file_id

        var { data } = await getAllFiles(discord_id)
        return Homeworklist.OpenFile.ButtonSelector(data.files,current_id)
    }
}
