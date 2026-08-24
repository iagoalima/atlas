import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from "discord.js";

export function createContainer() {
  return new ContainerBuilder();
}

export function createText(content: string) {
  return new TextDisplayBuilder().setContent(content);
}

export function createSeparator() {
  return new SeparatorBuilder()
    .setSpacing(SeparatorSpacingSize.Small);
}