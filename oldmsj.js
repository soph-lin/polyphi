/*
const client = new Client ({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
});

const prefix = '-';

client.on('messageCreate', message => {
    console.log('received!');
    console.log(message.content);
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    if (command === 'go') {
        message.channel.send('ginkgo!');
    }
});
*/