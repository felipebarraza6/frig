# Plan: salir de FTP en claro (P0-09)

**Estado:** diferido — requiere secrets/hosting y ventana de ops; no se toca en el PR de fixes.  
**Fecha:** 2026-10-16

## Problema

`deploy.yml` sube el mismo `out/` a tres hosts por **FTP puerto 21** (`SamKirkland/FTP-Deploy-Action`). Credenciales y artefactos viajan sin cifrar.

## Objetivo

Despliegue cifrado (FTPS o SFTP) o, preferible, un CDN/object storage + invalidación, con **un solo artefacto** reutilizado.

## Pasos

1. Inventariar soporte FTPS/SFTP en `ftp.yggdra.cl`, Macanuo y Agencia Patagonia.  
2. Si hay SFTP: cambiar action a SFTP (o `rsync`/scp) y rotar secretos.  
3. Si solo FTPS: configurar `protocol: ftps` / puerto 21 explícito implícito según el action.  
4. Build una vez → upload artifact → matrix de 3 hosts (o un host canónico + CDN).  
5. Mantener `.well-known` / sin `dangerous-clean-slate`.  
6. Documentar rotación de `FTP_*` secrets tras el corte.

## Mitigación interim (ya en PR de fixes)

- Deploy ya no re-ejecuta lint/typegen/tsc (solo `build` + post-export + upload) para reducir minutos de Actions mientras se planifica FTPS.
