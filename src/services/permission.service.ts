import { GuildMember } from "discord.js";

import { getGuildConfig } from "./guild-config.service.js";
import { isStaff } from "../permissions/staff.js";

export async function canManageMedals(
  member: GuildMember
): Promise<boolean> {
  const config = await getGuildConfig(member.guild.id);

  if (!config) {
    return false;
  }

  return isStaff(member, config.staffRoleId);
}