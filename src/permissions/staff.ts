import { GuildMember } from "discord.js";

export function isStaff(member: GuildMember, staffRoleId: string): boolean {
  return member.roles.cache.has(staffRoleId);
}