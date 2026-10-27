const API = "https://lightgreen-panther-830342.hostingersite.com/api/eventos.php";

console.info("MeetUp Planner: métricas inteligentes cada 5 segundos v17");

let intervaloInvitaciones = null;
let enviandoToken = false;
let intervaloQR = null;
let appInicializada = false;
let graficasMetricas = [];
let intervaloMetricas = null;
let metricasCargando = false;
let firmaMetricasAnterior = null;

/* =========================================================
   JWT / SESIÓN
========================================================= */

function obtenerJWT() {
    return localStorage.getItem("jwt") || "";
}

function obtenerHeaders(extra = {}) {

    const jwt = obtenerJWT();

    let headers = Object.assign({}, extra);

    if (jwt) {
        headers["Authorization"] = "Bearer " + jwt;
    }

    return headers;
}

function mostrarMenuProtegido() {

    $(".auth-only").removeClass("d-none");

    $(".menu-link")
        .closest(".nav-item")
        .removeClass("d-none");

    $("#btnCerrarSesion")
        .closest(".nav-item")
        .removeClass("d-none");

}

function ocultarMenuProtegido() {

    $(".auth-only").addClass("d-none");

    $(".menu-link")
        .closest(".nav-item")
        .addClass("d-none");

    $("#btnCerrarSesion")
        .closest(".nav-item")
        .addClass("d-none");

}

function guardarSesion(jwt) {

    localStorage.setItem("jwt", jwt);

    mostrarMenuProtegido();

    const tokenFirebase = localStorage.getItem("FBToken");

    if (tokenFirebase) {
        guardarFBToken(tokenFirebase);
    }

}

function cargarLogin() {

    detenerActualizacionMetricas();
    destruirGraficasMetricas();

    ocultarMenuProtegido();

    if (intervaloInvitaciones) {
        clearInterval(intervaloInvitaciones);
        intervaloInvitaciones = null;
    }

    if (intervaloQR) {
        clearInterval(intervaloQR);
        intervaloQR = null;
    }

    $("#css-vista").attr("href", "css/index.css");

    $("#contenido-principal").load("login.html", function () {
        history.replaceState(null, "", "#login.html");

        const ultimoCorreo = localStorage.getItem("ultimoCorreo") || "";

        if (ultimoCorreo) {
            $("#txtLoginCorreo").val(ultimoCorreo);
            $("#txtLoginPINCorreo").val(ultimoCorreo);
        }
    });

}

function cargarInicio() {

    detenerActualizacionMetricas();
    destruirGraficasMetricas();

    mostrarMenuProtegido();

    if (intervaloInvitaciones) {
        clearInterval(intervaloInvitaciones);
        intervaloInvitaciones = null;
    }

    $("#css-vista").attr("href", "css/index.css");

    $("#contenido-principal").load("inicio.html", function () {
        history.replaceState(null, "", "#inicio.html");

        if ($("#estadoPINTexto").length > 0) {
            cargarEstadoPIN();
        }
    });

}

function cerrarSesion(expirada = false) {

    detenerActualizacionMetricas();
    destruirGraficasMetricas();

    localStorage.removeItem("jwt");

    enviandoToken = false;

    ocultarMenuProtegido();

    if (intervaloInvitaciones) {
        clearInterval(intervaloInvitaciones);
        intervaloInvitaciones = null;
    }

    if (intervaloQR) {
        clearInterval(intervaloQR);
        intervaloQR = null;
    }

    cargarLogin();

    if (expirada) {
        alert("Tu sesión expiró. Inicia sesión nuevamente.");
    }

}

/* =========================================================
   FUNCIONES HTTP NATIVAS / JWT
========================================================= */

function httpGetJSON(url, callback) {

    const headers = obtenerHeaders();

    if (!window.cordova || !cordova.plugin || !cordova.plugin.http) {

        $.ajax({
            url: url,
            type: "GET",
            dataType: "json",
            headers: headers,

            success: function (data) {
                callback(data);
            },

            error: function (xhr) {

                if (xhr.status === 401 && obtenerJWT()) {
                    cerrarSesion(true);
                    return;
                }

                console.log("HTTP GET ERROR:", xhr.status);
                console.log("URL:", url);
                console.log("RESPUESTA:", xhr.responseText);

                let respuestaError = null;

                try {
                    respuestaError = xhr.responseJSON || JSON.parse(xhr.responseText);
                } catch (e) {
                    respuestaError = null;
                }

                callback(
                    respuestaError || {
                        success: false,
                        mensaje: "Error de conexión con el servidor"
                    }
                );

            }
        });

        return;
    }

    cordova.plugin.http.get(
        url,
        {},
        headers,
        function (response) {

            try {

                const data = JSON.parse(response.data);

                callback(data);

            } catch (e) {

                console.log("Error parseando JSON GET:", e);
                console.log("Respuesta recibida:", response.data);

            }

        },
        function (error) {

            if (error.status === 401 && obtenerJWT()) {
                cerrarSesion(true);
                return;
            }

            console.log("HTTP GET ERROR:", error.status);
            console.log("URL:", url);
            console.log("ERROR:", error.error);

            let respuestaError = null;

            try {
                respuestaError = JSON.parse(error.error);
            } catch (e) {
                respuestaError = null;
            }

            callback(
                respuestaError || {
                    success: false,
                    mensaje: "Error de conexión con el servidor"
                }
            );

        }
    );

}

function httpPostJSON(url, datos, callback) {

    const headers = obtenerHeaders({
        "Content-Type": "application/x-www-form-urlencoded"
    });

    if (!window.cordova || !cordova.plugin || !cordova.plugin.http) {

        $.ajax({
            url: url,
            type: "POST",
            data: datos,
            dataType: "json",
            headers: headers,

            success: function (data) {
                callback(data);
            },

            error: function (xhr) {

                if (xhr.status === 401 && obtenerJWT()) {
                    cerrarSesion(true);
                    return;
                }

                console.log("HTTP POST ERROR:", xhr.status);
                console.log("URL:", url);
                console.log("RESPUESTA:", xhr.responseText);

                let respuestaError = null;

                try {
                    respuestaError = xhr.responseJSON || JSON.parse(xhr.responseText);
                } catch (e) {
                    respuestaError = null;
                }

                callback(
                    respuestaError || {
                        success: false,
                        mensaje: "Error de conexión con el servidor"
                    }
                );

            }
        });

        return;
    }

    cordova.plugin.http.setDataSerializer("urlencoded");

    cordova.plugin.http.post(
        url,
        datos,
        headers,
        function (response) {

            try {

                const data = JSON.parse(response.data);

                callback(data);

            } catch (e) {

                console.log("Error parseando JSON POST:", e);
                console.log("Respuesta recibida:", response.data);

                callback({
                    success: false,
                    mensaje: "Respuesta inválida del servidor"
                });

            }

        },
        function (error) {

            if (error.status === 401 && obtenerJWT()) {
                cerrarSesion(true);
                return;
            }

            console.log("HTTP POST ERROR:", error.status);
            console.log("URL:", url);
            console.log("ERROR:", error.error);

            let respuestaError = null;

            try {
                respuestaError = JSON.parse(error.error);
            } catch (e) {
                respuestaError = null;
            }

            callback(
                respuestaError || {
                    success: false,
                    mensaje: "Error de conexión con el servidor"
                }
            );

        }
    );

}

/* =========================================================
   NAVEGACIÓN MEDIANTE HASH
========================================================= */

function obtenerVistaDesdeHash() {

    let vista = window.location.hash
        .replace("#", "")
        .replace(".html", "")
        .trim();

    const vistasPermitidas = [
        "inicio",
        "metricas",
        "eventos",
        "usuarios",
        "invitaciones"
    ];

    if (!vistasPermitidas.includes(vista)) {
        vista = "inicio";
    }

    return vista;
}

function cargarVistaDesdeHash() {

    const vista = obtenerVistaDesdeHash();

    if (vista === "inicio") {
        cargarInicio();
        return;
    }

    const enlace = $(
        '.menu-link[href="' + vista + '.html"]'
    ).first();

    if (enlace.length > 0) {
        enlace.trigger("click");
    } else {
        cargarInicio();
    }
}

/* =========================================================
   VERIFICAR SESIÓN INICIAL
========================================================= */

function verificarSesionInicial() {

    if (!obtenerJWT()) {
        cargarLogin();
        return;
    }

    httpGetJSON(
        API + "?sesion",
        function (respuesta) {

            if (respuesta.login) {
            
                mostrarMenuProtegido();
            
                cargarVistaDesdeHash();
            
            } else {

                localStorage.removeItem("jwt");

                cargarLogin();

            }

        }
    );

}

function iniciarAplicacionUnaVez() {

    if (appInicializada) {
        return;
    }

    appInicializada = true;

    ocultarMenuProtegido();

    verificarSesionInicial();

}

/* =========================================================
   LOGIN NORMAL
========================================================= */

$(document).on("submit", "#frmLogin", function (e) {

    e.preventDefault();

    const correo = $("#txtLoginCorreo").val();
    const contrasena = $("#txtLoginContrasena").val();

    if (
        correo.trim() === "" ||
        contrasena.trim() === ""
    ) {
        alert("Correo y contraseña son obligatorios");
        return;
    }

    $("#btnLogin")
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            Iniciando...
        `);

    httpPostJSON(
        API + "?iniciarSesion",
        {
            correo: correo,
            contrasena: contrasena
        },
        function (respuesta) {

            $("#btnLogin")
                .prop("disabled", false)
                .html("Iniciar sesión");

            if (respuesta.success) {

                if (respuesta.usuario && respuesta.usuario.correo) {
                    localStorage.setItem(
                        "ultimoCorreo",
                        respuesta.usuario.correo
                    );
                }

                guardarSesion(respuesta.jwt);

                cargarInicio();

            } else {

                alert(
                    respuesta.mensaje ||
                    "Correo o contraseña incorrectos"
                );

            }

        }
    );

});

/* =========================================================
   LOGIN MEDIANTE PIN
========================================================= */

$(document).on("submit", "#frmLoginPIN", function (e) {

    e.preventDefault();

    const correo = $("#txtLoginPINCorreo").val().trim();
    const pin = $("#txtLoginPIN").val().trim();

    if (correo === "" || pin === "") {
        alert("Correo y PIN son obligatorios");
        return;
    }

    if (!/^[0-9]{4,6}$/.test(pin)) {
        alert("El PIN debe contener entre 4 y 6 números");
        return;
    }

    $("#btnLoginPIN")
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            Iniciando...
        `);

    httpPostJSON(
        API + "?iniciarSesionPIN",
        {
            correo: correo,
            pin: pin
        },
        function (respuesta) {

            $("#btnLoginPIN")
                .prop("disabled", false)
                .html("Acceder con PIN");

            if (respuesta.success) {

                if (respuesta.usuario && respuesta.usuario.correo) {
                    localStorage.setItem(
                        "ultimoCorreo",
                        respuesta.usuario.correo
                    );
                }

                guardarSesion(respuesta.jwt);

                cargarInicio();

            } else {

                alert(
                    respuesta.mensaje ||
                    "No fue posible iniciar sesión mediante PIN"
                );

            }

        }
    );

});

/* =========================================================
   LOGIN POR QR
========================================================= */

$(document).on("click", "#btnGenerarQR", function () {

    $("#contenedorQR").removeClass("d-none");

    $("#divQR").html(`
        <div class="spinner-border text-primary"></div>
    `);

    $("#estadoQR").html("Generando QR...");

    httpGetJSON(
        API + "?generarQR",
        function (respuesta) {

            if (!respuesta.success) {

                $("#estadoQR").html("No se pudo generar el QR.");

                return;
            }

            $("#divQR").html(`
                <img
                    src="${respuesta.qr}"
                    class="img-fluid rounded shadow"
                    style="max-width: 260px;"
                    alt="QR de inicio de sesión">
            `);

            $("#estadoQR").html("Escanea el QR desde otro dispositivo.");

            const tokenQR = respuesta.tokenQR;

            if (intervaloQR) {
                clearInterval(intervaloQR);
            }

            intervaloQR = setInterval(function () {

                httpGetJSON(
                    API + "?validarQR&tokenQR=" + encodeURIComponent(tokenQR),
                    function (validacion) {

                        if (validacion.estado === "Pendiente") {

                            $("#estadoQR").html("Esperando confirmación...");

                            return;
                        }

                        if (validacion.estado === "Expirado") {

                            clearInterval(intervaloQR);
                            intervaloQR = null;

                            $("#estadoQR").html("El QR expiró. Genera uno nuevo.");

                            return;
                        }

                        if (
                            validacion.estado === "Confirmado" &&
                            validacion.jwt
                        ) {

                            clearInterval(intervaloQR);
                            intervaloQR = null;

                            $("#estadoQR").html("QR confirmado. Iniciando sesión...");

                            guardarSesion(validacion.jwt);

                            setTimeout(function () {
                                cargarInicio();
                            }, 1000);

                        }

                    }
                );

            }, 3000);

        }
    );

});

/* =========================================================
   ADMINISTRACIÓN DEL PIN
========================================================= */

function validarFormatoPIN(pin) {
    return /^[0-9]{4,6}$/.test(pin);
}

function limpiarCamposPIN() {
    $("#txtNuevoPIN").val("");
    $("#txtConfirmarPIN").val("");
    $("#txtPINActual").val("");
    $("#txtPINNuevoCambio").val("");
    $("#txtConfirmarPINCambio").val("");
}

function cargarEstadoPIN() {

    if (!obtenerJWT()) {
        return;
    }

    if ($("#estadoPINTexto").length === 0) {
        return;
    }

    $("#estadoPINTexto")
        .removeClass("alert-success alert-warning alert-danger")
        .addClass("alert-secondary")
        .html("Consultando configuración del PIN...");

    httpGetJSON(
        API + "?estadoPIN",
        function (respuesta) {

            if (!respuesta.success) {
                $("#estadoPINTexto")
                    .removeClass("alert-secondary alert-success alert-warning")
                    .addClass("alert-danger")
                    .html(
                        respuesta.mensaje ||
                        "No fue posible consultar el estado del PIN"
                    );
                return;
            }

            if (respuesta.tiene_pin) {

                let textoFecha = "";

                if (respuesta.pin_actualizado) {
                    textoFecha = ` Última actualización: ${respuesta.pin_actualizado}.`;
                }

                $("#estadoPINTexto")
                    .removeClass("alert-secondary alert-warning alert-danger")
                    .addClass("alert-success")
                    .html("PIN activo." + textoFecha);

                $("#bloqueCrearPIN").addClass("d-none");
                $("#bloqueAdministrarPIN").removeClass("d-none");

            } else {

                $("#estadoPINTexto")
                    .removeClass("alert-secondary alert-success alert-danger")
                    .addClass("alert-warning")
                    .html("No tienes un PIN configurado.");

                $("#bloqueCrearPIN").removeClass("d-none");
                $("#bloqueAdministrarPIN").addClass("d-none");

            }

        }
    );

}

$(document).on("input", ".campo-pin", function () {

    const valorLimpio = $(this)
        .val()
        .replace(/[^0-9]/g, "")
        .slice(0, 6);

    $(this).val(valorLimpio);

});

$(document).on("click", "#btnEstablecerPIN", function () {

    const pin = $("#txtNuevoPIN").val().trim();
    const confirmarPIN = $("#txtConfirmarPIN").val().trim();

    if (pin === "" || confirmarPIN === "") {
        alert("Debes escribir y confirmar el PIN");
        return;
    }

    if (!validarFormatoPIN(pin)) {
        alert("El PIN debe contener entre 4 y 6 números");
        return;
    }

    if (pin !== confirmarPIN) {
        alert("Los PIN no coinciden");
        return;
    }

    $("#btnEstablecerPIN")
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            Guardando...
        `);

    httpPostJSON(
        API,
        {
            establecerPIN: true,
            pin: pin,
            confirmarPIN: confirmarPIN
        },
        function (respuesta) {

            $("#btnEstablecerPIN")
                .prop("disabled", false)
                .html("Establecer PIN");

            alert(
                respuesta.mensaje ||
                (respuesta.success
                    ? "PIN establecido correctamente"
                    : "No fue posible establecer el PIN")
            );

            if (respuesta.success) {
                limpiarCamposPIN();
                cargarEstadoPIN();
            }

        }
    );

});

$(document).on("click", "#btnCambiarPIN", function () {

    const pinActual = $("#txtPINActual").val().trim();
    const pinNuevo = $("#txtPINNuevoCambio").val().trim();
    const confirmarPIN = $("#txtConfirmarPINCambio").val().trim();

    if (pinActual === "" || pinNuevo === "" || confirmarPIN === "") {
        alert("Todos los campos del PIN son obligatorios");
        return;
    }

    if (!validarFormatoPIN(pinActual) || !validarFormatoPIN(pinNuevo)) {
        alert("El PIN debe contener entre 4 y 6 números");
        return;
    }

    if (pinNuevo !== confirmarPIN) {
        alert("El nuevo PIN y su confirmación no coinciden");
        return;
    }

    if (pinActual === pinNuevo) {
        alert("El nuevo PIN debe ser diferente al PIN actual");
        return;
    }

    $("#btnCambiarPIN")
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            Cambiando...
        `);

    httpPostJSON(
        API,
        {
            cambiarPIN: true,
            pinActual: pinActual,
            pinNuevo: pinNuevo,
            confirmarPIN: confirmarPIN
        },
        function (respuesta) {

            $("#btnCambiarPIN")
                .prop("disabled", false)
                .html("Cambiar PIN");

            alert(
                respuesta.mensaje ||
                (respuesta.success
                    ? "PIN cambiado correctamente"
                    : "No fue posible cambiar el PIN")
            );

            if (respuesta.success) {
                limpiarCamposPIN();
                cargarEstadoPIN();
            }

        }
    );

});

$(document).on("click", "#btnEliminarPIN", function () {

    const pinActual = $("#txtPINActual").val().trim();

    if (pinActual === "") {
        alert("Escribe tu PIN actual para eliminarlo");
        return;
    }

    if (!validarFormatoPIN(pinActual)) {
        alert("El PIN debe contener entre 4 y 6 números");
        return;
    }

    const confirmarEliminacion = confirm(
        "¿Seguro que deseas eliminar tu PIN? Podrás seguir iniciando sesión con contraseña o QR."
    );

    if (!confirmarEliminacion) {
        return;
    }

    $("#btnEliminarPIN")
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            Eliminando...
        `);

    httpPostJSON(
        API,
        {
            eliminarPIN: true,
            pinActual: pinActual
        },
        function (respuesta) {

            $("#btnEliminarPIN")
                .prop("disabled", false)
                .html("Eliminar PIN");

            alert(
                respuesta.mensaje ||
                (respuesta.success
                    ? "PIN eliminado correctamente"
                    : "No fue posible eliminar el PIN")
            );

            if (respuesta.success) {
                limpiarCamposPIN();
                cargarEstadoPIN();
            }

        }
    );

});

/* =========================================================
   USUARIOS: LISTAR, BUSCAR, EDITAR Y ELIMINAR
========================================================= */

let usuariosDisponibles = [];
let idUsuarioEnEdicion = 0;

function escaparHTMLUsuario(valor) {
    return $("<div>").text(valor ?? "").html();
}

function normalizarBusquedaUsuario(valor) {
    return String(valor ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function limpiarFormularioUsuario() {

    const formulario = $("#frmRegistro")[0];

    if (formulario) {
        formulario.reset();
    }

    idUsuarioEnEdicion = 0;

    $("#txtREGID").val("");
    $("#tituloFormularioUsuario").html("Registro de Usuarios");
    $("#textoFormularioUsuario").html(
        "Administra los usuarios registrados dentro del sistema."
    );

    $("#modoEdicionUsuario").addClass("d-none");

    $("#lblREGContrasena").html("Contraseña");
    $("#lblREGConfirmarContrasena").html("Confirmar Contraseña");
    $("#ayudaContrasenaUsuario")
        .addClass("d-none")
        .html("");

    $("#btnREGGuardar")
        .prop("disabled", false)
        .removeClass("btn-warning")
        .addClass("btn-primary")
        .html("Guardar");

    $("#btnREGLimpiar").html("Limpiar");
}

function renderizarUsuarios(usuarios) {

    const tabla = $("#tablaUsuarios");

    if (tabla.length === 0) {
        return;
    }

    tabla.empty();

    const total = Array.isArray(usuarios) ? usuarios.length : 0;

    $("#contadorUsuarios").html(
        total === 1
            ? "1 usuario encontrado"
            : total + " usuarios encontrados"
    );

    if (total === 0) {
        tabla.append(`
            <tr>
                <td colspan="5" class="text-center text-muted py-5">
                    No se encontraron usuarios
                </td>
            </tr>
        `);
        return;
    }

    usuarios.forEach(function (usuario) {

        const id = Number(usuario.id_usuario || 0);
        const nombre = escaparHTMLUsuario(usuario.nombre_usuario);
        const correo = escaparHTMLUsuario(usuario.correo);
        const telefono = escaparHTMLUsuario(usuario.telefono);

        tabla.append(`
            <tr class="elegant-row" data-id-usuario="${id}">
                <td class="ps-4 fw-bold text-muted align-middle">
                    #${id}
                </td>

                <td class="align-middle">
                    <div class="fw-bold text-dark">
                        ${nombre}
                    </div>
                    <small class="text-muted">
                        Usuario registrado
                    </small>
                </td>

                <td class="align-middle">
                    <i class="bi bi-envelope-fill me-2 table-icon"></i>
                    ${correo}
                </td>

                <td class="align-middle">
                    <i class="bi bi-telephone-fill me-2 table-icon"></i>
                    ${telefono}
                </td>

                <td class="pe-4 align-middle">
                    <div class="acciones-usuario d-flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="btn btn-outline-primary btn-sm btn-editar-usuario"
                            data-id="${id}"
                        >
                            Editar
                        </button>

                        <button
                            type="button"
                            class="btn btn-outline-danger btn-sm btn-eliminar-usuario"
                            data-id="${id}"
                        >
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `);
    });
}

function filtrarUsuarios() {

    const termino = normalizarBusquedaUsuario(
        $("#txtBuscarUsuario").val()
    );

    if (termino === "") {
        renderizarUsuarios(usuariosDisponibles);
        return;
    }

    const filtrados = usuariosDisponibles.filter(function (usuario) {

        const texto = normalizarBusquedaUsuario([
            usuario.id_usuario,
            usuario.nombre_usuario,
            usuario.correo,
            usuario.telefono
        ].join(" "));

        return texto.includes(termino);
    });

    renderizarUsuarios(filtrados);
}

function cargarUsuarios(enfocar = false) {

    httpGetJSON(
        API + "?buscarUsuarios",
        function (respuesta) {

            if (!Array.isArray(respuesta)) {
                usuariosDisponibles = [];
                renderizarUsuarios([]);

                if (respuesta && respuesta.mensaje) {
                    alert(respuesta.mensaje);
                }

                return;
            }

            usuariosDisponibles = respuesta;
            filtrarUsuarios();

            if (enfocar && $("#txtBuscarUsuario").val().trim() === "") {
                enfocarUltimaFilaUsuarios("#tablaUsuarios");
            }
        }
    );
}

$(document).on("input", "#txtBuscarUsuario", function () {
    filtrarUsuarios();
});

$(document).on("click", "#btnLimpiarBusquedaUsuario", function () {
    $("#txtBuscarUsuario").val("").trigger("focus");
    renderizarUsuarios(usuariosDisponibles);
});

$(document).on("click", ".btn-editar-usuario", function () {

    const idUsuario = Number($(this).data("id"));

    const usuario = usuariosDisponibles.find(function (item) {
        return Number(item.id_usuario) === idUsuario;
    });

    if (!usuario) {
        alert("El usuario seleccionado ya no está disponible");
        cargarUsuarios();
        return;
    }

    idUsuarioEnEdicion = idUsuario;

    $("#txtREGID").val(idUsuario);
    $("#txtREGNombre").val(usuario.nombre_usuario || "");
    $("#txtREGCorreo").val(usuario.correo || "");
    $("#txtREGTelefono").val(usuario.telefono || "");
    $("#txtREGContraseña").val("");
    $("#txtREGConfirmarContraseña").val("");

    $("#tituloFormularioUsuario").html("Editar Usuario");
    $("#textoFormularioUsuario").html(
        "Actualiza la información del usuario seleccionado."
    );

    $("#modoEdicionUsuario")
        .removeClass("d-none")
        .html("Editando al usuario #" + idUsuario);

    $("#lblREGContrasena").html("Nueva contraseña");
    $("#lblREGConfirmarContrasena").html("Confirmar nueva contraseña");
    $("#ayudaContrasenaUsuario")
        .removeClass("d-none")
        .html("Déjalas vacías para conservar la contraseña actual.");

    $("#btnREGGuardar")
        .removeClass("btn-primary")
        .addClass("btn-warning")
        .html("Actualizar");

    $("#btnREGLimpiar").html("Cancelar edición");

    const formulario = document.getElementById("frmRegistro");

    if (formulario) {
        formulario.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    setTimeout(function () {
        $("#txtREGNombre").trigger("focus");
    }, 350);
});

$(document).on("click", "#btnREGLimpiar", function (e) {
    e.preventDefault();
    limpiarFormularioUsuario();
});

$(document).on("click", ".btn-eliminar-usuario", function () {

    const boton = $(this);
    const idUsuario = Number(boton.data("id"));

    const usuario = usuariosDisponibles.find(function (item) {
        return Number(item.id_usuario) === idUsuario;
    });

    if (!usuario) {
        alert("El usuario seleccionado ya no está disponible");
        cargarUsuarios();
        return;
    }

    const confirmar = confirm(
        "¿Seguro que deseas eliminar a " +
        usuario.nombre_usuario +
        "? Esta acción no se puede deshacer."
    );

    if (!confirmar) {
        return;
    }

    const textoOriginal = boton.html();

    boton
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm"></span>
        `);

    httpPostJSON(
        API,
        {
            eliminarUsuario: true,
            id_usuario: idUsuario
        },
        function (respuesta) {

            boton
                .prop("disabled", false)
                .html(textoOriginal);

            alert(
                respuesta.mensaje ||
                (respuesta.success
                    ? "Usuario eliminado correctamente"
                    : "No fue posible eliminar el usuario")
            );

            if (!respuesta.success) {
                return;
            }

            if (idUsuarioEnEdicion === idUsuario) {
                limpiarFormularioUsuario();
            }

            cargarUsuarios();
            cargarComboUsuarios();
        }
    );
});

$(document).on("submit", "#frmRegistro", function (e) {

    e.preventDefault();

    const nombre = $("#txtREGNombre").val().trim();
    const correo = $("#txtREGCorreo").val().trim();
    const telefono = $("#txtREGTelefono").val().trim();
    const contrasena = $("#txtREGContraseña").val();
    const confirmarContrasena = $("#txtREGConfirmarContraseña").val();
    const editando = idUsuarioEnEdicion > 0;

    if (nombre === "" || correo === "" || telefono === "") {
        alert("Nombre, correo y teléfono son obligatorios");
        return;
    }

    if (!editando && (contrasena.trim() === "" || confirmarContrasena.trim() === "")) {
        alert("La contraseña y su confirmación son obligatorias");
        return;
    }

    if (
        editando &&
        ((contrasena.trim() === "" && confirmarContrasena.trim() !== "") ||
        (contrasena.trim() !== "" && confirmarContrasena.trim() === ""))
    ) {
        alert("Escribe y confirma la nueva contraseña");
        return;
    }

    if (contrasena !== confirmarContrasena) {
        alert("Las contraseñas no coinciden");
        return;
    }

    const boton = $("#btnREGGuardar");
    const textoBoton = editando ? "Actualizar" : "Guardar";

    boton
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            ${editando ? "Actualizando..." : "Guardando..."}
        `);

    const datos = {
        nombre: nombre,
        correo: correo,
        telefono: telefono,
        contrasena: contrasena
    };

    if (editando) {
        datos.actualizarUsuario = true;
        datos.id_usuario = idUsuarioEnEdicion;
    } else {
        datos.guardarUsuario = true;
    }

    httpPostJSON(
        API,
        datos,
        function (respuesta) {

            boton
                .prop("disabled", false)
                .html(textoBoton);

            if (!respuesta.success) {
                alert(
                    respuesta.mensaje ||
                    (editando
                        ? "Error al actualizar el usuario"
                        : "Error al registrar el usuario")
                );
                return;
            }

            alert(
                respuesta.mensaje ||
                (editando
                    ? "Usuario actualizado correctamente"
                    : "Usuario registrado correctamente")
            );

            limpiarFormularioUsuario();
            cargarUsuarios(!editando);
            cargarComboUsuarios();
        }
    );
});

/* =========================================================
   EVENTOS
========================================================= */

let eventosDisponibles = [];
let idEventoEnEdicion = 0;

function escaparHTML(valor) {
    return $("<div>").text(valor ?? "").html();
}

function limpiarFormularioEvento() {

    const formulario = $("#frmEventos")[0];

    if (formulario) {
        formulario.reset();
    }

    idEventoEnEdicion = 0;

    $("#txtEVID").val("");
    $("#filEVImagen").val("");

    $("#btnEVGuardar")
        .prop("disabled", false)
        .removeClass("btn-warning")
        .addClass("btn-primary")
        .html("Guardar");

    $("#btnEVLimpiar").html("Limpiar");

    $("#estadoEdicionEvento")
        .addClass("d-none")
        .empty();

    $("#textoEVImagenActual")
        .text("Formatos permitidos: JPG, PNG y WEBP.");

}

function normalizarBusquedaEvento(valor) {

    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

}

function filtrarEventos(termino) {

    const busqueda = normalizarBusquedaEvento(termino);

    if (busqueda === "") {
        return eventosDisponibles;
    }

    return eventosDisponibles.filter(function (evento) {

        const contenidoEvento = [
            evento.id_evento,
            evento.titulo,
            evento.descripcion,
            evento.fecha,
            evento.hora,
            evento.ubicacion,
            evento.cliente
        ]
            .map(normalizarBusquedaEvento)
            .join(" ");

        return contenidoEvento.includes(busqueda);

    });

}

function actualizarResumenBusquedaEventos(cantidadMostrada, total, termino) {

    const textoCantidad = total === 1
        ? "1 Evento"
        : `${total} Eventos`;

    $("#badgeTotalEventos").text(textoCantidad);

    const buscando = normalizarBusquedaEvento(termino) !== "";

    $("#btnLimpiarBusquedaEvento")
        .toggleClass("d-none", !buscando);

    if (!buscando) {
        $("#resultadoBusquedaEventos").empty();
        return;
    }

    $("#resultadoBusquedaEventos").text(
        `${cantidadMostrada} resultado${cantidadMostrada === 1 ? "" : "s"} de ${total}`
    );

}

function renderizarEventos(eventos, enfocar = false) {

    const listaEventos = Array.isArray(eventos)
        ? eventos
        : [];

    const termino = $("#txtBuscarEvento").val() || "";

    $("#tablaEventos").empty();

    actualizarResumenBusquedaEventos(
        listaEventos.length,
        eventosDisponibles.length,
        termino
    );

    if (listaEventos.length === 0) {

        const mensaje = normalizarBusquedaEvento(termino) !== ""
            ? "No se encontraron eventos con esa búsqueda"
            : "No hay eventos registrados";

        $("#tablaEventos").append(`
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    ${mensaje}
                </td>
            </tr>
        `);

        return;
    }

    for (const evento of listaEventos) {

        const idEvento = Number(evento.id_evento);
        const titulo = escaparHTML(evento.titulo);
        const fecha = escaparHTML(evento.fecha);
        const ubicacion = escaparHTML(evento.ubicacion);
        const cliente = escaparHTML(evento.cliente || "Sin cliente");

        const miniaturaHTML = (evento.base64 && evento.mime)
            ? `<img src="data:${evento.mime};base64,${evento.base64}" class="img-evento rounded shadow-sm" alt="Imagen de ${titulo}">`
            : `<div class="img-evento placeholder-evento rounded d-flex align-items-center justify-content-center text-muted">Sin img</div>`;

        $("#tablaEventos").append(`
            <tr class="elegant-row" data-id-evento="${idEvento}">
                <td class="ps-4 fw-bold text-muted align-middle">
                    #${idEvento}
                </td>

                <td class="text-center align-middle">
                    ${miniaturaHTML}
                </td>

                <td class="align-middle">
                    <div class="fw-bold text-dark fs-6">
                        ${titulo}
                    </div>
                </td>

                <td class="align-middle text-nowrap">
                    <i class="bi bi-clock-fill me-2 table-icon"></i>
                    ${fecha}
                </td>

                <td class="align-middle">
                    <i class="bi bi-geo-alt-fill me-2 table-icon"></i>
                    ${ubicacion}
                </td>

                <td class="align-middle">
                    <i class="bi bi-person-fill me-2 table-icon"></i>
                    ${cliente}
                </td>

                <td class="pe-4 align-middle">
                    <div class="d-flex flex-column flex-sm-row gap-2 text-nowrap">
                        <button
                            type="button"
                            class="btn btn-outline-primary btn-sm btn-editar-evento"
                            data-id-evento="${idEvento}"
                            aria-label="Editar evento ${titulo}">
                            <i class="bi bi-pencil-square me-1"></i>
                            Editar
                        </button>

                        <button
                            type="button"
                            class="btn btn-outline-danger btn-sm btn-eliminar-evento"
                            data-id-evento="${idEvento}"
                            aria-label="Eliminar evento ${titulo}">
                            <i class="bi bi-trash me-1"></i>
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `);

    }

    if (enfocar) {
        enfocarUltimaFilaEventos("#tablaEventos");
    }

}

function cargarEventos(enfocar = false) {

    httpGetJSON(
        API + "?buscarEventos",
        function (eventos) {

            eventosDisponibles = Array.isArray(eventos)
                ? eventos
                : [];

            const termino = $("#txtBuscarEvento").val() || "";
            const eventosFiltrados = filtrarEventos(termino);

            renderizarEventos(
                eventosFiltrados,
                enfocar && normalizarBusquedaEvento(termino) === ""
            );

        }
    );

}

$(document).on("input", "#txtBuscarEvento", function () {

    const termino = $(this).val();
    const eventosFiltrados = filtrarEventos(termino);

    renderizarEventos(eventosFiltrados);

});

$(document).on("click", "#btnLimpiarBusquedaEvento", function (e) {

    e.preventDefault();

    $("#txtBuscarEvento")
        .val("")
        .trigger("focus");

    renderizarEventos(eventosDisponibles);

});

function prepararEdicionEvento(idEvento) {

    const evento = eventosDisponibles.find(function (item) {
        return Number(item.id_evento) === Number(idEvento);
    });

    if (!evento) {
        alert("No fue posible encontrar la información del evento");
        cargarEventos();
        return;
    }

    idEventoEnEdicion = Number(evento.id_evento);

    $("#txtEVID").val(idEventoEnEdicion);
    $("#txtEVTitulo").val(evento.titulo);
    $("#txtEVDescripcion").val(evento.descripcion);
    $("#txtEVUbicacion").val(evento.ubicacion);
    $("#txtEVFecha").val(evento.fecha);
    $("#txtEVHora").val(evento.hora);
    $("#filEVImagen").val("");

    const seleccionarCliente = function () {
        $("#cboEVCliente").val(String(evento.id_usuario));
    };

    if ($(`#cboEVCliente option[value="${evento.id_usuario}"]`).length > 0) {
        seleccionarCliente();
    } else {
        cargarComboUsuarios(seleccionarCliente);
    }

    $("#btnEVGuardar")
        .removeClass("btn-primary")
        .addClass("btn-warning")
        .html(`
            <i class="bi bi-check-circle me-1"></i>
            Actualizar
        `);

    $("#btnEVLimpiar").html("Cancelar edición");

    $("#estadoEdicionEvento")
        .removeClass("d-none")
        .html(`
            <i class="bi bi-pencil-square me-2"></i>
            Editando el evento <strong>#${idEventoEnEdicion}</strong>.
        `);

    $("#textoEVImagenActual").text(
        evento.imagen
            ? "La imagen actual se conservará si no seleccionas una nueva."
            : "Este evento no tiene imagen. Puedes seleccionar una ahora."
    );

    const formulario = document.getElementById("frmEventos");

    if (formulario) {
        formulario.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    setTimeout(function () {
        $("#txtEVTitulo").trigger("focus");
    }, 350);

}

function convertirImagenABase64(inputFile, callback) {

    if (
        !inputFile ||
        !inputFile.files ||
        inputFile.files.length === 0
    ) {
        callback(null);
        return;
    }

    const archivo = inputFile.files[0];
    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];

    if (!tiposPermitidos.includes(archivo.type)) {
        alert("La imagen debe ser JPG, PNG o WEBP");
        callback(false);
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {

        const resultado = e.target.result;
        const partes = resultado.split(",");

        callback({
            nombre: archivo.name,
            tipo: archivo.type,
            base64: partes[1]
        });

    };

    reader.onerror = function () {
        alert("No fue posible leer la imagen seleccionada");
        callback(false);
    };

    reader.readAsDataURL(archivo);

}

$(document).on("submit", "#frmEventos", function (e) {

    e.preventDefault();

    const titulo = $("#txtEVTitulo").val().trim();
    const descripcion = $("#txtEVDescripcion").val().trim();
    const ubicacion = $("#txtEVUbicacion").val().trim();
    const fecha = $("#txtEVFecha").val().trim();
    const hora = $("#txtEVHora").val().trim();
    const idUsuario = $("#cboEVCliente").val();
    const idEvento = Number($("#txtEVID").val()) || 0;
    const editando = idEvento > 0;

    const archivo = document.getElementById("filEVImagen");

    if (
        titulo === "" ||
        descripcion === "" ||
        ubicacion === "" ||
        fecha === "" ||
        hora === "" ||
        !idUsuario
    ) {
        alert("Todos los campos son obligatorios");
        return;
    }

    $("#btnEVGuardar")
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            ${editando ? "Actualizando..." : "Guardando..."}
        `);

    convertirImagenABase64(archivo, function (imagen) {

        if (imagen === false) {
            $("#btnEVGuardar")
                .prop("disabled", false)
                .html(editando ? "Actualizar" : "Guardar");
            return;
        }

        const datos = {
            txtEVTitulo: titulo,
            txtEVDescripcion: descripcion,
            txtEVUbicacion: ubicacion,
            txtEVFecha: fecha,
            txtEVHora: hora,
            cboEVCliente: idUsuario
        };

        if (editando) {
            datos.id_evento = idEvento;
        }

        if (imagen) {
            datos.imagenBase64 = imagen.base64;
            datos.imagenNombre = imagen.nombre;
            datos.imagenTipo = imagen.tipo;
        }

        const endpoint = editando
            ? API + "?actualizarEvento"
            : API + "?guardarEvento";

        httpPostJSON(
            endpoint,
            datos,
            function (respuesta) {

                $("#btnEVGuardar")
                    .prop("disabled", false)
                    .html(editando ? "Actualizar" : "Guardar");

                if (respuesta.success) {

                    alert(
                        respuesta.mensaje ||
                        (editando
                            ? "Evento actualizado correctamente"
                            : "Evento guardado correctamente")
                    );

                    limpiarFormularioEvento();
                    cargarEventos(!editando);
                    cargarComboEventos();

                } else {

                    alert(
                        respuesta.mensaje ||
                        (editando
                            ? "Error al actualizar el evento"
                            : "Error al guardar el evento")
                    );

                }

            }
        );

    });

});

$(document).on("click", ".btn-editar-evento", function (e) {
    e.preventDefault();

    const idEvento = Number($(this).data("id-evento"));
    prepararEdicionEvento(idEvento);
});

$(document).on("click", ".btn-eliminar-evento", function (e) {
    e.preventDefault();

    const boton = $(this);
    const idEvento = Number(boton.data("id-evento"));

    const evento = eventosDisponibles.find(function (item) {
        return Number(item.id_evento) === idEvento;
    });

    const titulo = evento
        ? evento.titulo
        : `#${idEvento}`;

    const confirmado = confirm(
        `¿Seguro que deseas eliminar el evento "${titulo}"?\n\n` +
        "También se eliminarán las invitaciones relacionadas. Esta acción no se puede deshacer."
    );

    if (!confirmado) {
        return;
    }

    boton
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-1"></span>
            Eliminando...
        `);

    httpPostJSON(
        API + "?eliminarEvento",
        {
            id_evento: idEvento
        },
        function (respuesta) {

            if (respuesta.success) {

                alert(
                    respuesta.mensaje ||
                    "Evento eliminado correctamente"
                );

                if (idEventoEnEdicion === idEvento) {
                    limpiarFormularioEvento();
                }

                cargarEventos();
                cargarComboEventos();

            } else {

                boton
                    .prop("disabled", false)
                    .html(`
                        <i class="bi bi-trash me-1"></i>
                        Eliminar
                    `);

                alert(
                    respuesta.mensaje ||
                    "No fue posible eliminar el evento"
                );

            }

        }
    );

});

$(document).on("click", "#btnEVLimpiar", function (e) {
    e.preventDefault();
    limpiarFormularioEvento();
});

/* =========================================================
   COMBO USUARIOS
========================================================= */

function cargarComboUsuarios(callback = null) {

    httpGetJSON(
        API + "?comboUsuarios",
        function (usuarios) {

            $("#cboEVCliente").empty();

            $("#cboEVCliente").append(`
                <option value="" selected disabled>
                    Selecciona un cliente
                </option>
            `);

            for (let x in usuarios) {

                let usuario = usuarios[x];

                $("#cboEVCliente").append(`
                    <option value="${usuario.id_usuario}">
                        ${escaparHTML(usuario.nombre_usuario)}
                    </option>
                `);

            }

            if (typeof callback === "function") {
                callback();
            }

        }
    );

}

/* =========================================================
   COMBO EVENTOS
========================================================= */

function cargarComboEventos(callback = null) {

    httpGetJSON(
        API + "?comboEventos",
        function (respuesta) {

            const eventos = Array.isArray(respuesta)
                ? respuesta
                : [];

            $("#cboIVEvento").empty();

            $("#cboIVEvento").append(`
                <option value="" selected disabled>
                    Selecciona un evento
                </option>
            `);

            eventos.forEach(function (evento) {

                $("#cboIVEvento").append(`
                    <option value="${Number(evento.id_evento || 0)}">
                        ${escaparHTMLInvitacion(evento.titulo)}
                    </option>
                `);

            });

            if (typeof callback === "function") {
                callback();
            }

        }
    );

}

/* =========================================================
   INVITACIONES: LISTAR, BUSCAR, EDITAR Y ELIMINAR
========================================================= */

let invitacionesDisponibles = [];
let idInvitacionEnEdicion = 0;

function escaparHTMLInvitacion(valor) {
    return $("<div>").text(valor ?? "").html();
}

function normalizarBusquedaInvitacion(valor) {
    return String(valor ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function correoInvitacionValido(correo) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function limpiarFormularioInvitacion() {

    const formulario = $("#frmInvitaciones")[0];

    if (formulario) {
        formulario.reset();
    }

    idInvitacionEnEdicion = 0;

    $("#txtIVID").val("");
    $("#cboIVEvento").val("");

    $("#cboIVEstado").val("Pendiente");

    $("#bloqueEstadoInvitacion")
        .addClass("d-none");

    $("#tituloFormularioInvitacion")
        .html("Nueva Invitación");

    $("#textoFormularioInvitacion").html(
        "Gestiona invitaciones y asistentes para tus eventos."
    );

    $("#modoEdicionInvitacion")
        .addClass("d-none")
        .html("");

    $("#btnAgregarInvitacion")
        .prop("disabled", false)
        .removeClass("btn-warning")
        .addClass("btn-primary")
        .html("Enviar invitación");

    $("#btnIVLimpiar")
        .html("Limpiar");
}

function obtenerColorEstadoInvitacion(estado) {

    const valor = String(estado || "").toLowerCase();

    if (valor === "confirmado") {
        return "success";
    }

    if (valor === "pendiente") {
        return "warning";
    }

    if (valor === "cancelado") {
        return "danger";
    }

    return "secondary";
}

function renderizarInvitaciones(invitaciones) {

    const tabla = $("#tablaInvitaciones");

    if (tabla.length === 0) {
        return;
    }

    tabla.empty();

    const total = Array.isArray(invitaciones)
        ? invitaciones.length
        : 0;

    $("#contadorInvitaciones").html(
        total === 1
            ? "1 invitación encontrada"
            : total + " invitaciones encontradas"
    );

    if (total === 0) {
        tabla.append(`
            <tr>
                <td colspan="7" class="text-center text-muted py-5">
                    No se encontraron invitaciones
                </td>
            </tr>
        `);
        return;
    }

    invitaciones.forEach(function (invitacion) {

        const id = Number(invitacion.id_invitacion || 0);
        const evento = escaparHTMLInvitacion(invitacion.titulo);
        const nombre = escaparHTMLInvitacion(invitacion.nombre);
        const correo = escaparHTMLInvitacion(invitacion.correo);
        const mensaje = escaparHTMLInvitacion(invitacion.mensaje);
        const estado = escaparHTMLInvitacion(
            invitacion.estado_asistencia || "Sin estado"
        );
        const color = obtenerColorEstadoInvitacion(
            invitacion.estado_asistencia
        );

        tabla.append(`
            <tr data-id-invitacion="${id}">
                <td class="ps-4 fw-bold text-muted align-middle">
                    #${id}
                </td>

                <td class="align-middle">
                    <div class="fw-semibold text-dark">
                        ${evento}
                    </div>
                </td>

                <td class="align-middle">
                    ${nombre}
                </td>

                <td class="align-middle">
                    ${correo}
                </td>

                <td class="align-middle">
                    <span
                        class="mensaje-invitacion"
                        title="${mensaje}"
                    >
                        ${mensaje}
                    </span>
                </td>

                <td class="align-middle">
                    <span class="badge bg-${color}">
                        ${estado}
                    </span>
                </td>

                <td class="pe-4 align-middle">
                    <div class="acciones-invitacion d-flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="btn btn-outline-primary btn-sm btn-editar-invitacion"
                            data-id="${id}"
                        >
                            Editar
                        </button>

                        <button
                            type="button"
                            class="btn btn-outline-danger btn-sm btn-eliminar-invitacion"
                            data-id="${id}"
                        >
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `);

    });
}

function filtrarInvitaciones() {

    const termino = normalizarBusquedaInvitacion(
        $("#txtBuscarInvitacion").val()
    );

    if (termino === "") {
        renderizarInvitaciones(invitacionesDisponibles);
        return;
    }

    const filtradas = invitacionesDisponibles.filter(function (invitacion) {

        const texto = normalizarBusquedaInvitacion([
            invitacion.id_invitacion,
            invitacion.titulo,
            invitacion.nombre,
            invitacion.correo,
            invitacion.mensaje,
            invitacion.estado_asistencia
        ].join(" "));

        return texto.includes(termino);
    });

    renderizarInvitaciones(filtradas);
}

function cargarInvitaciones() {

    httpGetJSON(
        API + "?buscarInvitaciones",
        function (respuesta) {

            if (!Array.isArray(respuesta)) {
                invitacionesDisponibles = [];
                renderizarInvitaciones([]);

                if (respuesta && respuesta.mensaje) {
                    console.log(respuesta.mensaje);
                }

                return;
            }

            invitacionesDisponibles = respuesta;

            if (idInvitacionEnEdicion > 0) {
                const sigueDisponible = invitacionesDisponibles.some(
                    function (item) {
                        return Number(item.id_invitacion) ===
                            idInvitacionEnEdicion;
                    }
                );

                if (!sigueDisponible) {
                    limpiarFormularioInvitacion();
                }
            }

            filtrarInvitaciones();
        }
    );
}

$(document).on("input", "#txtBuscarInvitacion", function () {
    filtrarInvitaciones();
});

$(document).on("click", "#btnLimpiarBusquedaInvitacion", function () {
    $("#txtBuscarInvitacion").val("").trigger("focus");
    renderizarInvitaciones(invitacionesDisponibles);
});

$(document).on("click", ".btn-editar-invitacion", function () {

    const idInvitacion = Number($(this).data("id"));

    const invitacion = invitacionesDisponibles.find(function (item) {
        return Number(item.id_invitacion) === idInvitacion;
    });

    if (!invitacion) {
        alert("La invitación seleccionada ya no está disponible");
        cargarInvitaciones();
        return;
    }

    idInvitacionEnEdicion = idInvitacion;

    $("#txtIVID").val(idInvitacion);
    $("#txtIVNombre").val(invitacion.nombre || "");
    $("#txtIVCorreo").val(invitacion.correo || "");
    $("#txtIVMensaje").val(invitacion.mensaje || "");

    $("#cboIVEstado").val(
        invitacion.estado_asistencia || "Pendiente"
    );

    $("#bloqueEstadoInvitacion")
        .removeClass("d-none");

    const seleccionarEvento = function () {
        $("#cboIVEvento").val(String(invitacion.id_evento || ""));
    };

    const opcionEvento = $(
        '#cboIVEvento option[value="' +
        Number(invitacion.id_evento || 0) +
        '"]'
    );

    if (opcionEvento.length > 0) {
        seleccionarEvento();
    } else {
        cargarComboEventos(seleccionarEvento);
    }

    $("#tituloFormularioInvitacion").html("Editar Invitación");
    $("#textoFormularioInvitacion").html(
        "Actualiza la información de la invitación seleccionada."
    );

    $("#modoEdicionInvitacion")
        .removeClass("d-none")
        .html("Editando la invitación #" + idInvitacion);

    $("#btnAgregarInvitacion")
        .removeClass("btn-primary")
        .addClass("btn-warning")
        .html("Actualizar invitación");

    $("#btnIVLimpiar").html("Cancelar edición");

    const formulario = document.getElementById("frmInvitaciones");

    if (formulario) {
        formulario.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    setTimeout(function () {
        $("#txtIVNombre").trigger("focus");
    }, 350);
});

$(document).on("click", "#btnIVLimpiar", function () {
    limpiarFormularioInvitacion();
});

$(document).on("click", ".btn-eliminar-invitacion", function () {

    const boton = $(this);
    const idInvitacion = Number(boton.data("id"));

    const invitacion = invitacionesDisponibles.find(function (item) {
        return Number(item.id_invitacion) === idInvitacion;
    });

    if (!invitacion) {
        alert("La invitación seleccionada ya no está disponible");
        cargarInvitaciones();
        return;
    }

    const confirmar = confirm(
        "¿Seguro que deseas eliminar la invitación de " +
        invitacion.nombre +
        " para el evento " +
        invitacion.titulo +
        "? Esta acción no se puede deshacer."
    );

    if (!confirmar) {
        return;
    }

    const textoOriginal = boton.html();

    boton
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm"></span>
        `);

    httpPostJSON(
        API,
        {
            eliminarInvitacion: true,
            id_invitacion: idInvitacion
        },
        function (respuesta) {

            if (respuesta && respuesta.success) {

                alert(
                    respuesta.mensaje ||
                    "Invitación eliminada correctamente"
                );

                if (idInvitacionEnEdicion === idInvitacion) {
                    limpiarFormularioInvitacion();
                }

                cargarInvitaciones();
                return;
            }

            boton
                .prop("disabled", false)
                .html(textoOriginal);

            alert(
                respuesta && respuesta.mensaje
                    ? respuesta.mensaje
                    : "No fue posible eliminar la invitación"
            );
        }
    );
});

function agregarInvitacion() {

    const nombre = $("#txtIVNombre")
        .val()
        .trim();

    const correo = $("#txtIVCorreo")
        .val()
        .trim()
        .toLowerCase();

    const idEvento = Number(
        $("#cboIVEvento").val() || 0
    );

    const mensaje = $("#txtIVMensaje")
        .val()
        .trim();

    const estado = $("#cboIVEstado")
        .val() || "Pendiente";

    const editando =
        idInvitacionEnEdicion > 0;

    if (
        nombre === "" ||
        correo === "" ||
        idEvento <= 0 ||
        mensaje === ""
    ) {

        alert(
            "Todos los campos son obligatorios"
        );

        return;
    }

    if (!correoInvitacionValido(correo)) {

        alert(
            "Escribe un correo electrónico válido"
        );

        return;
    }

    /*
        El estado solamente se valida y se envía
        cuando se está editando.
    */
    const estadosPermitidos = [
        "Pendiente",
        "Confirmado",
        "Cancelado"
    ];

    if (
        editando &&
        !estadosPermitidos.includes(estado)
    ) {

        alert(
            "Selecciona un estado válido"
        );

        return;
    }

    const datos = {
        nombre: nombre,
        correo: correo,
        id_evento: idEvento,
        mensaje: mensaje
    };

    if (editando) {

        datos.actualizarInvitacion = true;

        datos.id_invitacion =
            idInvitacionEnEdicion;

        datos.estado_asistencia =
            estado;

    } else {

        /*
            No se manda el estado al registrar.
            El backend y la base de datos utilizarán
            Pendiente como valor inicial.
        */
        datos.agregarInvitacion = true;

    }

    $("#btnAgregarInvitacion")
        .prop("disabled", true)
        .html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            ${editando ? "Actualizando..." : "Enviando..."}
        `);

    httpPostJSON(
        API,
        datos,
        function (respuesta) {

            $("#btnAgregarInvitacion")
                .prop("disabled", false);

            if (
                respuesta &&
                respuesta.success
            ) {

                alert(
                    respuesta.mensaje ||
                    (
                        editando
                            ? "Invitación actualizada correctamente"
                            : "Invitación registrada correctamente"
                    )
                );

                limpiarFormularioInvitacion();

                cargarInvitaciones();

                return;
            }

            $("#btnAgregarInvitacion")
                .removeClass(
                    "btn-primary btn-warning"
                )
                .addClass(
                    editando
                        ? "btn-warning"
                        : "btn-primary"
                )
                .html(
                    editando
                        ? "Actualizar invitación"
                        : "Enviar invitación"
                );

            alert(
                respuesta &&
                respuesta.mensaje
                    ? respuesta.mensaje
                    : "No fue posible guardar la invitación"
            );
        }
    );
}


/* =========================================================
   MÉTRICAS / DASHBOARD
========================================================= */

function detenerActualizacionMetricas() {

    if (intervaloMetricas) {
        clearInterval(intervaloMetricas);
        intervaloMetricas = null;
    }

    metricasCargando = false;
}

function iniciarActualizacionMetricas() {

    detenerActualizacionMetricas();

    if ($("#metricasDashboard").length === 0) {
        return;
    }

    cargarMetricas(true);

    intervaloMetricas = setInterval(function () {

        if ($("#metricasDashboard").length === 0) {
            detenerActualizacionMetricas();
            destruirGraficasMetricas();
            return;
        }

        cargarMetricas();

    }, 5000);
}

function destruirGraficasMetricas() {

    if (!Array.isArray(graficasMetricas)) {
        graficasMetricas = [];
        return;
    }

    graficasMetricas.forEach(function (grafica) {
        try {
            grafica.destroy();
        } catch (error) {
            console.log("No fue posible destruir una gráfica:", error);
        }
    });

    graficasMetricas = [];
}

function numeroMetrica(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function textoMetrica(valor, textoSingular, textoPlural) {
    const cantidad = numeroMetrica(valor);

    return cantidad === 1
        ? `1 ${textoSingular}`
        : `${cantidad} ${textoPlural}`;
}

function obtenerOpcionesBaseGrafica(tipo, altura = 340) {

    return {
        chart: {
            type: tipo,
            height: altura,
            fontFamily: "Arial, Helvetica, sans-serif",
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: false,
                    zoom: false,
                    zoomin: false,
                    zoomout: false,
                    pan: false,
                    reset: false
                }
            },
            animations: {
                enabled: true,
                easing: "easeinout",
                speed: 650
            }
        },
        colors: [
            "#9c9384",
            "#d6b84c",
            "#6c7a89",
            "#6f9f7a",
            "#c97575"
        ],
        dataLabels: {
            enabled: false
        },
        grid: {
            borderColor: "#ece8df",
            strokeDashArray: 4
        },
        tooltip: {
            theme: "light"
        },
        noData: {
            text: "No hay información disponible",
            align: "center",
            verticalAlign: "middle",
            style: {
                color: "#6c757d",
                fontSize: "14px"
            }
        },
        responsive: [
            {
                breakpoint: 768,
                options: {
                    chart: {
                        height: 285,
                        toolbar: {
                            show: false
                        }
                    },
                    legend: {
                        position: "bottom"
                    }
                }
            },
            {
                breakpoint: 480,
                options: {
                    chart: {
                        height: 250
                    }
                }
            }
        ]
    };
}

function crearGraficaMetrica(selector, opciones) {

    const elemento = document.querySelector(selector);

    if (!elemento) {
        return;
    }

    const grafica = new ApexCharts(elemento, opciones);

    graficasMetricas.push(grafica);

    grafica.render();
}

function renderizarResumenMetricas(resumen) {

    const datos = resumen || {};

    $("#metricaTotalEventos").text(numeroMetrica(datos.total_eventos));
    $("#metricaProximosEventos").text(numeroMetrica(datos.proximos_eventos));
    $("#metricaTotalUsuarios").text(numeroMetrica(datos.total_usuarios));
    $("#metricaTotalInvitaciones").text(numeroMetrica(datos.total_invitaciones));
    $("#metricaConfirmadas").text(numeroMetrica(datos.invitaciones_confirmadas));

    $("#metricaEventosHoyTexto").text(
        textoMetrica(datos.eventos_hoy, "evento hoy", "eventos hoy")
    );

    $("#metricaPendientesTexto").text(
        textoMetrica(
            datos.invitaciones_pendientes,
            "invitación pendiente",
            "invitaciones pendientes"
        )
    );

    $("#metricaTasaConfirmacion").text(
        `${numeroMetrica(datos.tasa_confirmacion)}% de confirmación`
    );
}

function renderizarTablaProximosEventos(eventos) {

    const lista = Array.isArray(eventos) ? eventos : [];
    const tabla = $("#tablaProximosEventosMetricas");

    tabla.empty();

    if (lista.length === 0) {
        tabla.append(`
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    No hay eventos próximos
                </td>
            </tr>
        `);
        return;
    }

    lista.forEach(function (evento) {

        const id = numeroMetrica(evento.id_evento);
        const titulo = escaparHTML(evento.titulo || "Sin título");
        const fecha = escaparHTML(evento.fecha || "");
        const hora = escaparHTML(evento.hora || "");
        const ubicacion = escaparHTML(evento.ubicacion || "Sin ubicación");
        const cliente = escaparHTML(evento.cliente || "Sin cliente");

        tabla.append(`
            <tr>
                <td class="fw-semibold">#${id}</td>
                <td>
                    <div class="fw-semibold text-dark">${titulo}</div>
                    <small class="text-muted">${cliente}</small>
                </td>
                <td class="text-nowrap">${fecha}</td>
                <td class="text-nowrap">${hora}</td>
                <td>${ubicacion}</td>
            </tr>
        `);
    });
}

function renderizarGraficasMetricas(datos) {

    destruirGraficasMetricas();

    if (typeof ApexCharts === "undefined") {
        $("#alertaMetricas")
            .removeClass("d-none alert-secondary")
            .addClass("alert-danger")
            .text("No fue posible cargar la librería de gráficas.");
        return;
    }

    const eventosMes = Array.isArray(datos.eventos_por_mes)
        ? datos.eventos_por_mes
        : [];

    const invitacionesEstado = Array.isArray(datos.invitaciones_por_estado)
        ? datos.invitaciones_por_estado
        : [];

    const eventosCliente = Array.isArray(datos.eventos_por_cliente)
        ? datos.eventos_por_cliente
        : [];

    const eventosUbicacion = Array.isArray(datos.eventos_por_ubicacion)
        ? datos.eventos_por_ubicacion
        : [];

    const invitacionesEvento = Array.isArray(datos.invitaciones_por_evento)
        ? datos.invitaciones_por_evento
        : [];

    const opcionesEventosMes = obtenerOpcionesBaseGrafica("area", 350);

    Object.assign(opcionesEventosMes, {
        series: [
            {
                name: "Eventos",
                data: eventosMes.map(item => numeroMetrica(item.total))
            }
        ],
        xaxis: {
            categories: eventosMes.map(item => item.etiqueta),
            labels: {
                rotate: -35
            }
        },
        yaxis: {
            min: 0,
            forceNiceScale: true,
            labels: {
                formatter: function (valor) {
                    return Math.round(valor);
                }
            }
        },
        stroke: {
            curve: "smooth",
            width: 3
        },
        fill: {
            type: "gradient",
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.08,
                stops: [0, 90, 100]
            }
        },
        markers: {
            size: 4
        }
    });

    crearGraficaMetrica("#graficaEventosMes", opcionesEventosMes);

    const opcionesEstados = obtenerOpcionesBaseGrafica("donut", 350);

    Object.assign(opcionesEstados, {
        series: invitacionesEstado.map(item => numeroMetrica(item.total)),
        labels: invitacionesEstado.map(item => item.estado),
        legend: {
            position: "bottom"
        },
        plotOptions: {
            pie: {
                donut: {
                    size: "68%",
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: "Invitaciones",
                            formatter: function (contexto) {
                                return contexto.globals.seriesTotals
                                    .reduce(
                                        (total, valor) => total + valor,
                                        0
                                    );
                            }
                        }
                    }
                }
            }
        }
    });

    crearGraficaMetrica("#graficaEstadosInvitaciones", opcionesEstados);

    const opcionesClientes = obtenerOpcionesBaseGrafica("bar", 350);

    Object.assign(opcionesClientes, {
        series: [
            {
                name: "Eventos",
                data: eventosCliente.map(item => numeroMetrica(item.total))
            }
        ],
        xaxis: {
            categories: eventosCliente.map(item => item.cliente)
        },
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 6,
                barHeight: "58%"
            }
        }
    });

    crearGraficaMetrica("#graficaEventosCliente", opcionesClientes);

    const opcionesUbicaciones = obtenerOpcionesBaseGrafica("bar", 350);

    Object.assign(opcionesUbicaciones, {
        series: [
            {
                name: "Eventos",
                data: eventosUbicacion.map(item => numeroMetrica(item.total))
            }
        ],
        xaxis: {
            categories: eventosUbicacion.map(item => item.ubicacion)
        },
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 6,
                barHeight: "58%"
            }
        }
    });

    crearGraficaMetrica("#graficaEventosUbicacion", opcionesUbicaciones);

    const opcionesInvitacionesEvento = obtenerOpcionesBaseGrafica("bar", 350);

    Object.assign(opcionesInvitacionesEvento, {
        series: [
            {
                name: "Invitaciones",
                data: invitacionesEvento.map(item => numeroMetrica(item.total))
            }
        ],
        xaxis: {
            categories: invitacionesEvento.map(item => item.evento),
            labels: {
                rotate: -35,
                trim: true
            }
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: "52%"
            }
        }
    });

    crearGraficaMetrica(
        "#graficaInvitacionesEvento",
        opcionesInvitacionesEvento
    );
}

function crearFirmaMetricas(respuesta) {

    const datosComparables = {
        resumen: respuesta.resumen || {},
        eventos_por_mes: respuesta.eventos_por_mes || [],
        invitaciones_por_estado: respuesta.invitaciones_por_estado || [],
        eventos_por_cliente: respuesta.eventos_por_cliente || [],
        eventos_por_ubicacion: respuesta.eventos_por_ubicacion || [],
        invitaciones_por_evento: respuesta.invitaciones_por_evento || [],
        proximos_eventos: respuesta.proximos_eventos || []
    };

    return JSON.stringify(datosComparables);
}

function cargarMetricas(forzarRender = false) {

    if ($("#metricasDashboard").length === 0 || metricasCargando) {
        return;
    }

    metricasCargando = true;

    if (forzarRender) {
        $("#alertaMetricas")
            .removeClass("d-none alert-danger alert-success")
            .addClass("alert-secondary")
            .text("Consultando métricas...");
    }

    httpGetJSON(
        API + "?metricasDashboard",
        function (respuesta) {

            metricasCargando = false;

            if ($("#metricasDashboard").length === 0) {
                return;
            }

            if (!respuesta || !respuesta.success) {

                $("#alertaMetricas")
                    .removeClass("d-none alert-secondary alert-success")
                    .addClass("alert-danger")
                    .text(
                        respuesta && respuesta.mensaje
                            ? respuesta.mensaje
                            : "No fue posible cargar las métricas"
                    );

                return;
            }

            const firmaActual = crearFirmaMetricas(respuesta);
            const huboCambios = firmaActual !== firmaMetricasAnterior;

            if (!forzarRender && !huboCambios) {
                return;
            }

            firmaMetricasAnterior = firmaActual;

            renderizarResumenMetricas(respuesta.resumen);
            renderizarGraficasMetricas(respuesta);
            renderizarTablaProximosEventos(respuesta.proximos_eventos);

            $("#fechaActualizacionMetricas").text(
                respuesta.generado_en
                    ? `Último cambio detectado: ${respuesta.generado_en}`
                    : "Las métricas se actualizan cuando cambian los datos"
            );

            $("#alertaMetricas")
                .removeClass("alert-secondary alert-danger")
                .addClass("d-none")
                .text("");
        }
    );
}


/* =========================================================
   NAVEGACIÓN
========================================================= */

$(document).ready(function () {
    window.addEventListener("popstate", function () {
    
        if (!obtenerJWT()) {
            cargarLogin();
            return;
        }
    
        cargarVistaDesdeHash();
    
    });

    ocultarMenuProtegido();

    if (!window.cordova) {
        iniciarAplicacionUnaVez();
    }

    $(document).on("click", "#btnAgregarInvitacion", function () {
        agregarInvitacion();
    });

    $(document).on("click", "#btnCerrarSesion", function (e) {

        e.preventDefault();

        cerrarSesion(false);

    });

    $(document).on("click", ".menu-link", function (e) {

        e.preventDefault();

        if (!obtenerJWT()) {

            alert("Primero debes iniciar sesión");

            cargarLogin();

            return;
        }

        let destino = $(this).attr("href");

        let boton = $(this);

        if (destino && destino !== "#") {
            
            const nombreVista = destino.replace(".html", "");

            history.pushState(null, "", "#" + nombreVista);

            if (destino.includes("metricas.html")) {
                $("#css-vista").attr(
                    "href",
                    "css/metricas.css?v=17"
                );
            }
            else if (destino.includes("eventos.html")) {
                $("#css-vista").attr(
                    "href",
                    "css/eventos.css"
                );
            }
            else if (destino.includes("invitaciones.html")) {
                $("#css-vista").attr(
                    "href",
                    "css/invitaciones.css?v=15"
                );
            }
            else if (destino.includes("usuarios.html")) {
                $("#css-vista").attr(
                    "href",
                    "css/usuarios.css?v=13"
                );
            }
            else if (destino.includes("inicio.html")) {
                $("#css-vista").attr(
                    "href",
                    "css/index.css"
                );
            }

            if (!destino.includes("metricas.html")) {
                detenerActualizacionMetricas();
                destruirGraficasMetricas();
            }

            $("#contenido-principal").fadeOut(200, function () {

                $(this).load(destino, function (response, status, xhr) {

                    if (status == "error") {

                        $(this).html(`
                            <div class="container my-5 text-center">
                                <div class="alert alert-danger">
                                    Error ${xhr.status}
                                </div>
                            </div>
                        `);

                    }
                    else {

                        if ($("#metricasDashboard").length > 0) {
                            iniciarActualizacionMetricas();
                        } else {
                            detenerActualizacionMetricas();
                        }

                        if ($("#tablaEventos").length > 0) {

                            cargarEventos();

                            cargarComboUsuarios();

                        }

                        if ($("#tablaInvitaciones").length > 0) {

                            cargarInvitaciones();

                            cargarComboEventos();

                            if (intervaloInvitaciones) {
                                clearInterval(intervaloInvitaciones);
                            }

                            intervaloInvitaciones = setInterval(function () {
                                cargarInvitaciones();
                            }, 5000);

                        }
                        else {

                            if (intervaloInvitaciones) {
                                clearInterval(intervaloInvitaciones);
                                intervaloInvitaciones = null;
                            }

                        }

                        if (
                            typeof cargarMensajes === "function" &&
                            $("#contenedorMensajes").length > 0
                        ) {
                            cargarMensajes();
                        }

                        if ($("#tablaUsuarios").length > 0) {
                            cargarUsuarios();
                        }

                        if ($("#estadoPINTexto").length > 0) {
                            cargarEstadoPIN();
                        }

                        $(".menu-link").removeClass("fw-bold");

                        boton.addClass("fw-bold");

                    }

                    $(this).fadeIn(300);

                });

            });

        }

    });

});

/* =========================================================
   FIREBASE PUSH
========================================================= */

function guardarFBToken(token) {

    if (!token) {
        return;
    }

    if (!obtenerJWT()) {

        console.log("Token Firebase obtenido, pero aún no hay sesión JWT");

        return;
    }

    if (enviandoToken) {
        return;
    }

    enviandoToken = true;

    httpPostJSON(
        API,
        {
            guardarFBToken: true,
            token: token
        },
        function (respuesta) {

            console.log("Token guardado:", JSON.stringify(respuesta));

            enviandoToken = false;

        }
    );

}

function obtenerFBToken() {

    if (!window.FirebasexMessaging) {
        return;
    }

    window.FirebasexMessaging.getToken(
        function (token) {

            console.log(
                "Firebase Token:",
                token
            );

            localStorage.setItem(
                "FBToken",
                token
            );

            guardarFBToken(
                token
            );

        },
        function (error) {

            console.log(
                "Error obteniendo Firebase Token:",
                error
            );

        }
    );

}

/* =========================================================
   ENFOQUE DE FILAS
========================================================= */

function enfocarUltimaFilaUsuarios(tabla) {

    setTimeout(function () {

        const fila = $(tabla).find("tr").last();

        if (fila.length === 0) {
            return;
        }

        fila[0].scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        fila.addClass("table-warning");

        setTimeout(function () {
            fila.removeClass("table-warning");
        }, 3000);

    }, 300);

}

function enfocarUltimaFilaEventos(tabla) {

    setTimeout(function () {

        const fila = $(tabla).find("tr").first();

        if (fila.length === 0) {
            return;
        }

        fila[0].scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        fila.addClass("table-warning");

        setTimeout(function () {
            fila.removeClass("table-warning");
        }, 3000);

    }, 300);

}

/* =========================================================
   VISTAS POR PUSH
========================================================= */

function cargarVistaPush(vista, css, callback) {

    if (!obtenerJWT()) {
        return;
    }

    $("#css-vista").attr("href", css);

    history.pushState(null, "", "#" + vista.replace(".html", ""));

    $("#contenido-principal").fadeOut(200, function () {

        $(this).load(vista, function () {

            $(this).fadeIn(300);

            setTimeout(function () {
                callback();
            }, 300);

        });

    });

}

function manejarVistaPorPush(modulo) {

    if (!obtenerJWT()) {
        return;
    }

    if (modulo === "usuarios") {

        if ($("#tablaUsuarios").length > 0) {

            cargarUsuarios();

            cargarComboUsuarios();

            enfocarUltimaFilaUsuarios("#tablaUsuarios");

        } else {

            cargarVistaPush(
                "usuarios.html",
                "css/usuarios.css?v=13",
                function () {

                    cargarUsuarios();

                    cargarComboUsuarios();

                    enfocarUltimaFilaUsuarios("#tablaUsuarios");

                }
            );

        }

    }

    if (modulo === "eventos") {

        if ($("#tablaEventos").length > 0) {

            cargarEventos();

            cargarComboEventos();

            enfocarUltimaFilaEventos("#tablaEventos");

        } else {

            cargarVistaPush(
                "eventos.html",
                "css/eventos.css",
                function () {

                    cargarEventos();

                    cargarComboUsuarios();

                    cargarComboEventos();

                    enfocarUltimaFilaEventos("#tablaEventos");

                }
            );

        }

    }

    if (modulo === "invitaciones") {

        if ($("#tablaInvitaciones").length > 0) {

            cargarInvitaciones();

            enfocarUltimaFilaEventos("#tablaInvitaciones");

        } else {

            cargarVistaPush(
                "invitaciones.html",
                "css/invitaciones.css?v=15",
                function () {

                    cargarInvitaciones();

                    cargarComboEventos();

                    enfocarUltimaFilaEventos("#tablaInvitaciones");

                }
            );

        }

    }

}

function fOnPushNotification(message) {

    console.log(
        "Push recibida:",
        JSON.stringify(message)
    );

    alert(
        message.body ||
        "Nueva notificación recibida"
    );

    const data = message.data || message;

    manejarVistaPorPush(data.modulo);

}

function iniciarFirebase() {

    if (window.FirebasexMessaging) {

        console.log(
            "Firebase Messaging disponible"
        );

        obtenerFBToken();

        window.FirebasexMessaging.onTokenRefresh(
            function (token) {

                console.log(
                    "Token actualizado:",
                    token
                );

                localStorage.setItem(
                    "FBToken",
                    token
                );

                guardarFBToken(
                    token
                );

            }
        );

        window.FirebasexMessaging.onMessageReceived(
            function (message) {

                fOnPushNotification(message);

            }
        );

    }
    else {

        console.log(
            "Firebase aún no está disponible, reintentando..."
        );

        setTimeout(
            iniciarFirebase,
            1000
        );

    }

}

/* =========================================================
   CORDOVA READY
========================================================= */

document.addEventListener("deviceready", function () {

    console.log(
        "Dispositivo listo"
    );

    if (window.cordova && cordova.plugin && cordova.plugin.http) {

        cordova.plugin.http.get(
            API + "?PING",
            {},
            obtenerHeaders(),
            function (response) {
                console.log("PING NATIVO OK:", response.data);
            },
            function (error) {
                console.log("PING NATIVO ERROR:", error.status);
                console.log("PING NATIVO ERROR DATA:", error.error);
            }
        );

    } else {

        console.log("cordova-plugin-advanced-http no disponible");

    }

    iniciarFirebase();

    iniciarAplicacionUnaVez();

}, false);