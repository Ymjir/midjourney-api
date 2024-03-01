import { DiscordImage, MJConfig } from "./interfaces";
import { sleep } from "./utils";

export const Commands = [
  "ask",
  "blend",
  "describe",
  "fast",
  "help",
  "imagine",
  "info",
  "prefer",
  "private",
  "public",
  "relax",
  "settings",
  "show",
  "stealth",
  "shorten",
  "subscribe",
] as const;
export type CommandName = (typeof Commands)[number];
function getCommandName(name: string): CommandName | undefined {
  for (const command of Commands) {
    if (command === name) {
      return command;
    }
  }
}

type CommandItem = {
  "id": string,
  "type": number,
  "application_id": string,
  "version": string,
  "name": string,
  "description": string
}

export class Command {
  constructor(public config: MJConfig) {}
  cache: Partial<Record<CommandName, Command>> = {};

  async cacheCommand(name: CommandName) {
    if (this.cache[name] !== undefined) {
      return this.cache[name];
    }

    // The new application-command-index API has a timeout of around 3-4 seconds before we can call it again,
    // adding a delay of 5 seconds just to be safe.
    await sleep(1000 * 5);

    if (this.config.ServerId) {
      const command = await this.getCommand(name);
      this.cache[name] = command;
      return command;
    }
    await this.allCommand();
    return this.cache[name];
  }
  async allCommand() {
    const url = `${this.config.DiscordBaseUrl}/api/v10/guilds/${this.config.ServerId}/application-command-index`;

    const response = await this.config.fetch(url, {
      headers: { authorization: this.config.SalaiToken },
    });

    const data = await response.json();
    if (data?.application_commands) {
      data.application_commands.forEach((command: any) => {
        const name = getCommandName(command.name);
        if (name) {
          this.cache[name] = command;
        }
      });
    }
  }

  async getCommand(name: CommandName, retryCount = 0): Promise<CommandItem> {
    const url = `${this.config.DiscordBaseUrl}/api/v10/guilds/${this.config.ServerId}/application-command-index`;

    const response = await this.config.fetch(url, {
      headers: { authorization: this.config.SalaiToken },
    });
    const data = await response.json();

    // failsafe: if sleep for 5 seconds fails for some unknown reasons.
    if (data?.retry_after && retryCount < 3) {
      await sleep(1000 * data?.retry_after);
      return await this.getCommand(name, retryCount + 1);
    }

    const command = data?.application_commands?.find(
      (application_command: CommandItem) =>
        application_command.type === 1 && application_command.name === name,
    );

    if (command) {
      return command;
    }

    throw new Error(`Failed to get application_commands for command ${name}`);
  }
  async imaginePayload(prompt: string, nonce?: string) {
    const data = await this.commandData("imagine", [
      {
        type: 3,
        name: "prompt",
        value: prompt,
      },
    ]);
    return this.data2Paylod(data, nonce);
  }
  async PreferPayload(nonce?: string) {
    const data = await this.commandData("prefer", [
      {
        type: 1,
        name: "remix",
        options: [],
      },
    ]);
    return this.data2Paylod(data, nonce);
  }

  async shortenPayload(prompt: string, nonce?: string) {
    const data = await this.commandData("shorten", [
      {
        type: 3,
        name: "prompt",
        value: prompt,
      },
    ]);
    return this.data2Paylod(data, nonce);
  }
  async infoPayload(nonce?: string) {
    const data = await this.commandData("info");
    return this.data2Paylod(data, nonce);
  }
  async fastPayload(nonce?: string) {
    const data = await this.commandData("fast");
    return this.data2Paylod(data, nonce);
  }
  async relaxPayload(nonce?: string) {
    const data = await this.commandData("relax");
    return this.data2Paylod(data, nonce);
  }
  async settingsPayload(nonce?: string) {
    const data = await this.commandData("settings");
    return this.data2Paylod(data, nonce);
  }
  async describePayload(image: DiscordImage, nonce?: string) {
    const data = await this.commandData(
      "describe",
      [
        {
          type: 11,
          name: "image",
          value: image.id,
        },
      ],
      [
        {
          id: <string>image.id,
          filename: image.filename,
          uploaded_filename: image.upload_filename,
        },
      ],
    );
    return this.data2Paylod(data, nonce);
  }

  protected async commandData(
    name: CommandName,
    options: any[] = [],
    attachments: any[] = [],
  ) {
    const command = await this.cacheCommand(name);
    const data = {
      version: command.version,
      id: command.id,
      name: command.name,
      type: command.type,
      options,
      application_command: command,
      attachments,
    };
    return data;
  }
  //TODO data type
  protected data2Paylod(data: any, nonce?: string) {
    const payload = {
      type: 2,
      application_id: data.application_command.application_id,
      guild_id: this.config.ServerId,
      channel_id: this.config.ChannelId,
      session_id: this.config.SessionId,
      nonce,
      data,
    };
    return payload;
  }
}
