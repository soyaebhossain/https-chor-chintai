import "reflect-metadata";
import { Module, Controller, Post, Body } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { createHmac } from "node:crypto";
import { z } from "zod";

const SearchInput = z.object({ type: z.enum(["IMEI","SERIAL","VIN","SERVICE_TAG"]), value: z.string().min(4).max(64) });
const normalize = (value:string) => value.trim().toUpperCase().replace(/[\s-]/g, "");

@Controller("v1")
class RegistryController {
  @Post("search")
  search(@Body() body:unknown) {
    const input = SearchInput.parse(body);
    const normalized = normalize(input.value);
    const lookupHash = createHmac("sha256", process.env.IDENTIFIER_HMAC_SECRET ?? "development-only").update(`${input.type}:${normalized}`).digest("hex");
    return { matched: false, lookupReference: lookupHash.slice(0, 12), disclaimer: "No record is not proof of lawful ownership." };
  }
}

@Module({ controllers:[RegistryController] }) class AppModule {}

async function bootstrap(){
  const app=await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({logger:true}));
  await app.register(helmet as never);
  app.enableCors({origin:(process.env.CORS_ORIGINS??"http://localhost:3000").split(","),credentials:true});
  const config=new DocumentBuilder().setTitle("Chor Chintai Registry API").setVersion("1.0").addBearerAuth().build();
  SwaggerModule.setup("docs",app,SwaggerModule.createDocument(app,config));
  await app.listen(Number(process.env.PORT??4000),"0.0.0.0");
}
bootstrap();
