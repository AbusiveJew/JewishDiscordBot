const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('./config');

function makeEmbed(client, options) {
  const {
    title,
    description,
    color = BRAND.colors.dark,
    fields = [],
    thumbnail = null,
    footer,
    timestamp: useTimestamp = true,
    includeAuthor = true,
  } = options;

  const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color);

  const footerText = footer === undefined ? BRAND.footer : footer;
  if (footerText) embed.setFooter({ text: footerText });
  if (useTimestamp) embed.setTimestamp();
  if (includeAuthor && client.user) {
    embed.setAuthor({ name: BRAND.name, iconURL: client.user.displayAvatarURL() });
  }

  if (fields.length > 0) embed.addFields(fields);
  if (thumbnail) embed.setThumbnail(thumbnail);

  return embed;
}

module.exports = { makeEmbed };
