Tengo una serie de mejoras que necesito hacer en mi proyecto, vamos a hacer primero la migración o migraciones necesarias para que funcione correctamente y luego hacemos los cambios en front ent y back end, ahora solo las migraciones

Deja escrita la migración en C:\SIRA\backend\migrations para que yo la ejecute

puedes consultar mi DDL actualizado en C:\SIRA\BD\DDL PRODUCCION y mis migraciones en la carpeta anterior

las mejoras que quiero realizar son:

1) Necesito una tabla para que se registren las cargas de gasolinas desde /unidades, esta carga debera registrar la unidad seleccionada por su ID, el km, el costo total de la carga en MXN, el tipo de combustible debe tomarse desde la BD ya que está asignado a cada unidad en BD, y de forma opcional seleccionar sitio y proyecto al que se estara viajando (de la misma forma que se selecciona sitio y proyecto en /G_REQ)

Estas cargas de gasolina deben tener una columna de pagado o no pagado, y debe registrar cual fue la fuente del pago de las disponibles en /FIN_FUENTES_PAGO, el usuario debe registrar varias cargas y al final tener la opción mor medio de UI de rgistrar todos los pagos en un solo depostio por el total de todas las cargas

2) Cualquier usuario debe poder hacer una requisición de efectivo o viaticos al departamento de finanzas, esto deberá realizarse desde /dashboard,el usuario deberá seleccionar el sitio y el proyecto destino, el nombre o nombres de los empleados que estarán viajando, (se registra el usuario logeado en solicitado por, y se registran los empleados que estaran viajando desde la tabla empleados) el usuario podrá ingresar Sitio y proyecto destino, cantidad solicitada, por default en MXN, dias de viaje, así como poder solicitar, hospedaje (indicando el número de noches fecha de inicio y fecha final) y transporte indicando fecha de salida desdea , fecha de regreso origen y destno.

3) mi tabla catálogo_materiales debe tener las siguientes columnas para cada material, ancho, unidad de ancho, altura, unidad de altura, longitud, unidad de longitud, peso, unidad de peso, cantidad de uso, unidad de uso,  (estas ultimas dos se refieren a que por ejemplo a veces compro una paqute de 25 plumas pero de almacen salen por unidad, entonces entra como 1 paquete y en cantidad de uso diria 25 y en unidad una FK a ´PZ´ en la talba de undiades, de hecho todas las unidades deben ser FK  la tabla de catalogo_unidades)

4) necesito una tabla para el depadtamento de logistica llamda incoterm con las siguientes columnas, id, incoterm, abreviatura, 

5) necesito una tabla llamda catalogo_ensambles cono id, nombre, descripción, y otra tabla para sus detalles, modelo 3D que será un link a google bucket con versiones y columnda para la actual, así como cada ensamble debera tenner una lista de materiales apra su fabricación, los cuales seran un FK a catalogo_materiales, cantidad que puede ser decimal y una KF a catalogo de unidades, y un comentario, (decidir si poner la lista de materiales encesarios en la misma tabla que el modelado 3D del google bucket o en tablas separadas)

6)Necesito una tabla de preferencias de IMPORTACION, donde para cada OC marcada como IMPO, se registraran las preferencias que deben imprimirse en el PDF de la OC, por ejemplo si se desea o no imprmir el sitio y el proyecto registrado en la OC, la dirección de entrega seleccionada desde la taba sitios, el incoterm de cada OC, 

7) para todas las OC marcadas como impo necesito una tabla de incrementables_OC, con la fk a la oc, tipo de incrementable que vendra de una fk a una tabla nueva llamda tipo_incrementables la cual debera contener simplemente si id, nombre y código, un incrementable puede ser aplicado idealmente a una sola OC (pór ejemplo un flete maritimo) o a varias OC, registrados por su FK, ademas de registrar la OC a la que se aplicará dicho incrementable debe registrar su REQ de donde salió la OC a la que se aplicará el incremntable, y debe registrar la nueva OC que es la que tendra el detalle del incrementable en si, por ejemplo la OC de un flete maritimo donde la viene la mercancia de una o mas OC previamente realizadas, o los impuestos, flete de ultima milla etc.
