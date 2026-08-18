import { IsNotEmpty, IsString, IsUrl, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric characters and hyphens only',
  })
  slug!: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  webhookUrl!: string;
}
