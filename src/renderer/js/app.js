// Arquivo: src/renderer/js/app.js
import { db } from './database.js'

// Variáveis globais
let services = []
let sales = []
let stock = []
let transactions = []
let selectedParts = []
let cart = []
let currentSale = null

// Inicialização da aplicação
document.addEventListener("DOMContentLoaded", () => {
    initializeApp()
    setupEventListeners()
})

async function initializeApp() {
    // Mostrar data atual
    //document.getElementById("currentDate").textContent = new Date().toLocaleDateString("pt-BR")

    // Carregar dados
    await loadAllData()

    // Atualizar dashboard
    updateDashboard()

    if (document.querySelector('#pdv-tab.active')) {
        initializePDV()
    }
}

function setupEventListeners() {
    // Busca em serviços
    document.getElementById("serviceSearch").addEventListener("input", function () {
        filterServices(this.value)
    })

    // Busca em vendas
    document.getElementById("salesSearch").addEventListener("input", function () {
        filterSales(this.value)
    })

    // Busca em estoque
    document.getElementById("stockSearch").addEventListener("input", () => {
        filterStock()
    })

    // Filtro de categoria do estoque
    document.getElementById("stockCategoryFilter").addEventListener("change", () => {
        filterStock()
    })

    // Tipo de venda
    document.querySelectorAll('input[name="saleType"]').forEach((radio) => {
        radio.addEventListener("change", function () {
            toggleSaleFields(this.value)
        })
    })

    // Tabs
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach((tab) => {
        tab.addEventListener("shown.bs.tab", (event) => {
            const target = event.target.getAttribute("data-bs-target")
            if (target === "#stock") {
                loadStockDevices()
            }
        })
    })

    // NOVOS EVENT LISTENERS:

    // Botões de salvar
    document.getElementById("saveServiceBtn")?.addEventListener('click', saveService);
    document.getElementById("refreshPDVSearch")?.addEventListener('click', loadProductsGrid);
    document.getElementById("saveSaleBtn")?.addEventListener('click', saveSale);
    document.getElementById("saveTransactionBtn")?.addEventListener('click', saveTransaction);
    document.getElementById("saveStockBtn")?.addEventListener('click', saveStock);
    document.getElementById("updateStockBtn")?.addEventListener('click', updateStock);

    // Delegação de eventos para elementos dinâmicos
    document.addEventListener('change', function (e) {
        // Select de status de serviço
        if (e.target.classList.contains('service-status-select')) {
            const serviceId = e.target.getAttribute('data-service-id');
            updateServiceStatus(serviceId, e.target.value);
        }
    });

    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('service-listener-PDV')) {
            const serviceId = e.target.getAttribute('data-service-id');
            addToCart(serviceId)
        }

        if (e.target.classList.contains('edit-service')) {
            const serviceId = e.target.getAttribute('data-service-id');
            updateService(serviceId)
        }

        if (e.target.classList.contains('delete-service')) {
            const serviceId = e.target.getAttribute('data-service-id');
            deleteService(serviceId);
        }

        if (e.target.classList.contains('generate-pdf')) {
            const serviceId = e.target.getAttribute('data-service-id');
            generateServicePDF(serviceId)
        }

        if (e.target.classList.contains('print-service')) {
            const serviceId = e.target.getAttribute('data-service-id');
            generateServicePrint(serviceId)
        }

        // Botão de estoque
        if (e.target.classList.contains('update-stock-btn')) {
            const itemId = e.target.getAttribute('data-item-id');
            openStockUpdateModal(itemId);
        }

        if (e.target.classList.contains('update-transaction-btn')) {
            const itemId = e.target.getAttribute('data-transaction-id');
            updateTransactionStatus(itemId);
        }

        if (e.target.classList.contains('edit-stock')) {
            const stockId = e.target.getAttribute('data-stock-id');
            updateStockItem(stockId);
        }

        if (e.target.classList.contains('delete-stock')) {
            const stockId = e.target.getAttribute('data-stock-id');
            deleteStockItem(stockId);
        }

        // Botões de vendas
        if (e.target.classList.contains('edit-sale')) {
            const saleId = e.target.getAttribute('data-sale-id');
            updateSale(saleId);
        }

        if (e.target.classList.contains('delete-sale')) {
            const saleId = e.target.getAttribute('data-sale-id');
            deleteSale(saleId);
        }

        // Botões de transações
        if (e.target.classList.contains('edit-transaction')) {
            const transactionId = e.target.getAttribute('data-transaction-id');
            updateTransactionItem(transactionId);
        }

        if (e.target.classList.contains('delete-transaction')) {
            const transactionId = e.target.getAttribute('data-transaction-id');
            deleteTransaction(transactionId);
        }
    });

    initializePDV()
}

async function loadAllData() {
    try {
        // Carregar dados do banco
        services = await db.getServices()
        sales = await db.getSales()
        stock = await db.getStock()
        transactions = await db.getTransactions()

        // Atualizar tabelas
        updateServicesTable()
        updateSalesTable()
        updateStockTable()
        updateFinancialTables()
        updateServicesList()
        updateSalesList()

        // Carregar opções de peças
        loadPartsOptions()
        loadStockDevices()
    } catch (error) {
        console.error("Error loading data:", error)
    }
}

function updateDashboard() {
    // Calcular métricas
    const serviceRevenue = services.filter((s) => s.status === "Entregue").reduce((sum, s) => sum + (s.value || 0), 0)

    const salesRevenue = sales.reduce((sum, s) => sum + (s.sale_price || 0), 0)

    const totalRevenue = serviceRevenue + salesRevenue

    const pendingAmount = services.filter((s) => s.status !== "Entregue").reduce((sum, s) => sum + (s.value || 0), 0)

    const pendingServices = services.filter((s) => s.status !== "Entregue").length

    const lowStockCount = stock.filter((item) => item.quantity <= item.min_quantity).length

    // Atualizar cards do dashboard
    document.getElementById("serviceRevenue").textContent = formatCurrency(serviceRevenue)
    document.getElementById("salesRevenue").textContent = formatCurrency(salesRevenue)
    document.getElementById("pendingAmount").textContent = formatCurrency(pendingAmount)
    document.getElementById("lowStockCount").textContent = lowStockCount

    if (totalRevenue > 0) {
        document.getElementById("servicePercentage").textContent =
            `${((serviceRevenue / totalRevenue) * 100).toFixed(1)}% do total`
        document.getElementById("salesPercentage").textContent =
            `${((salesRevenue / totalRevenue) * 100).toFixed(1)}% do total`
    }

    document.getElementById("pendingServices").textContent = `${pendingServices} serviços pendentes`

    // Atualizar métricas de vendas
    const totalProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0)
    const averageTicket = sales.length > 0 ? salesRevenue / sales.length : 0
    const averageMargin = salesRevenue > 0 ? (totalProfit / salesRevenue) * 100 : 0

    document.getElementById("totalSalesValue").textContent = formatCurrency(salesRevenue)
    document.getElementById("totalSalesCount").textContent = `${sales.length} aparelhos vendidos`
    document.getElementById("totalProfit").textContent = formatCurrency(totalProfit)
    document.getElementById("averageMargin").textContent = `Margem média: ${averageMargin.toFixed(1)}%`
    document.getElementById("averageTicket").textContent = formatCurrency(averageTicket)

    // Atualizar métricas de estoque
    const totalStockItems = stock.reduce((sum, item) => sum + item.quantity, 0)
    const totalStockValueGross = stock.reduce((sum, item) => sum + item.quantity * item.purchase_price, 0)
    const totalStockValueProfit = stock.reduce((sum, item) => sum + item.quantity * (item.sale_price - item.purchase_price), 0)
    const outOfStockItems = stock.filter((item) => item.quantity === 0).length

    document.getElementById("totalStockItems").textContent = totalStockItems
    document.getElementById("lowStockCount").textContent = totalStockItems
    document.getElementById("totalStockTypes").textContent = `${stock.length} tipos diferentes`
    document.getElementById("totalStockValueGross").textContent = formatCurrency(totalStockValueGross)
    document.getElementById("totalStockValueProfit").textContent = formatCurrency(totalStockValueProfit)
    document.getElementById("outOfStockItems").textContent = outOfStockItems

    // Atualizar métricas financeiras
    const totalIncome = transactions
        .filter((t) => t.type === "entrada" && t.status === "pago")
        .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = transactions
        .filter((t) => t.type === "saida" && t.status === "pago")
        .reduce((sum, t) => sum + t.amount, 0)

    const totalPending = transactions
        .filter((t) => t.type === "entrada" && t.status === "pendente")
        .reduce((sum, t) => sum + t.amount, 0)

    document.getElementById("totalIncome").textContent = formatCurrency(totalIncome)
    document.getElementById("totalExpenses").textContent = formatCurrency(totalExpenses)
    document.getElementById("totalPending").textContent = formatCurrency(totalPending)
    document.getElementById("netBalance").textContent = formatCurrency(totalIncome - totalExpenses)
}

function updateServicesTable() {
    const tbody = document.getElementById("servicesTable")
    tbody.innerHTML = ""

    services.forEach((service) => {
        const row = document.createElement("tr")
        row.innerHTML = `
            <td>#${service.id}</td>
            <td>
                <div>
                    <strong>${service.customer_name}</strong><br>
                    <small class="text-muted">${service.customer_phone}</small>
                </div>
            </td>
            <td>${service.device}</td>
            <td>${service.problem}</td>
            <td>${formatCurrency(service.value)}</td>
            <td>${getStatusBadge(service.status)}</td>
            <td>${service.delivery_date ? formatDate(service.delivery_date) : "-"}</td>
            <td>
                <div class="d-flex gap-1">
                    <select class="form-select form-select-sm service-status-select" data-service-id="${service.id}">
                        <option value="Em andamento" ${service.status === "Em andamento" ? "selected" : ""}>Em andamento</option>
                        <option value="Aguardando peça" ${service.status === "Aguardando peça" ? "selected" : ""}>Aguardando peça</option>
                        <option value="Pronto" ${service.status === "Pronto" ? "selected" : ""}>Pronto</option>
                        <option value="Entregue" ${service.status === "Entregue" ? "selected" : ""}>Entregue</option>
                    </select>
                </div>
            </td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false" data-service-id="${service.id}">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item edit-service" href="#" data-service-id="${service.id}"><i class="bi bi-pencil me-2"></i>Editar</a></li>
                        <li><a class="dropdown-item generate-pdf" href="#" data-service-id="${service.id}"><i class="bi bi-file-pdf me-2"></i>Gerar PDF</a></li>
                        <li><a class="dropdown-item print-service" href="#" data-service-id="${service.id}"><i class="bi bi-printer me-2"></i>Imprimir</a></li>
                        <li><a class="dropdown-item delete-service text-danger" href="#" data-service-id="${service.id}"><i class="bi bi-trash me-2"></i>Excluir</a></li>
                    </ul>
                </div>
            </td>
        `
        tbody.appendChild(row)
    })
}

function updateSalesTable() {
    const tbody = document.getElementById("salesTable")
    tbody.innerHTML = ""

    sales.forEach((sale) => {
        const row = document.createElement("tr")
        row.innerHTML = `
            <td>#${sale.id}</td>
            <td>
                <div>
                    <strong>${sale.device}</strong><br>
                    <small class="text-muted">${sale.storage || ""}</small>
                </div>
            </td>
            <td>${getConditionBadge(sale.condition)}</td>
            <td>${formatCurrency(sale.sale_price)}</td>
            <td>${formatDate(sale.created_at)}</td>
            <td>${sale.customer_name || "-"}</td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <!--<li><a class="dropdown-item edit-sale" href="#" data-sale-id="${sale.id}"><i class="bi bi-pencil me-2"></i>Editar</a></li>-->
                        <li><a class="dropdown-item delete-sale text-danger" href="#" data-sale-id="${sale.id}"><i class="bi bi-trash me-2"></i>Excluir</a></li>
                    </ul>
                </div>
            </td>
        `
        tbody.appendChild(row)
    })
}

function updateStockTable() {
    const tbody = document.getElementById("stockTable")
    tbody.innerHTML = ""

    stock.forEach((item) => {
        const row = document.createElement("tr")
        row.innerHTML = `
            <td>
                <div>
                    <strong>${item.name}</strong><br>
                    ${item.brand && item.model ? `<small class="text-muted">${item.brand} ${item.model}</small>` : ""}
                </div>
            </td>
            <td>${getCategoryLabel(item.category)}</td>
            <td><strong>${item.quantity}</strong></td>
            <td>${formatCurrency(item.purchase_price)}</td>
            <td>${formatCurrency(item.sale_price)}</td>
            <td>${getStockStatusBadge(item.state)}</td>
            <td>${item.code || "-"}</td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item edit-stock" href="#" data-stock-id="${item.id}"><i class="bi bi-pencil me-2"></i>Editar</a></li>
                        <li><a class="dropdown-item delete-stock text-danger" href="#" data-stock-id="${item.id}"><i class="bi bi-trash me-2"></i>Excluir</a></li>
                    </ul>
                </div>
            </td>
        `
        tbody.appendChild(row)
    })
}

function updateFinancialTables() {
    updateAllTransactionsTable()
    updateIncomeTable()
    updateExpensesTable()
    updatePendingTable()
}

function updateServicesList() {
    const tbody = document.getElementById("recentServices")
    tbody.innerHTML = ""

    services.slice(0, 4).forEach((item) => {
        const row = document.createElement("div")
        row.classList.add("d-flex", "justify-content-between", "align-items-center", "py-2", "border-bottom")
        row.innerHTML = `
            <div>
                <p class="mb-1 fw-medium">${item.device} - ${item.problem}</p>
                <p class="mb-0 text-muted small">${item.customer_name}</p>
            </div>
            <div class="text-end">
                <p class="mb-1 fw-medium">${formatCurrency(item.value)}</p>
                ${getStatusBadge(item.status)}
            </div>
        `
        tbody.appendChild(row)
    })
}

function updateSalesList() {
    const tbody = document.getElementById("recentSales")
    tbody.innerHTML = ""

    sales.slice(0, 4).forEach((item) => {
        const row = document.createElement("div")
        row.classList.add("d-flex", "justify-content-between", "align-items-center", "py-2", "border-bottom")
        row.innerHTML = `
            <div>
                <p class="mb-1 fw-medium">${item.model} ${item.storage}G</p>
                <p class="mb-0 text-muted small">${item.condition}</p>
            </div>
            <div class="text-end">
                <p class="mb-1 fw-medium">${formatCurrency(item.sale_price)}</p>
                <p class="mb-0 text-muted small">${formatDate(item.created_at)}</p>
            </div>
        `
        tbody.appendChild(row)
    })
}

function updateAllTransactionsTable() {
    const tbody = document.getElementById("allTransactionsTable")
    tbody.innerHTML = ""

    transactions.forEach((transaction) => {
        const row = document.createElement("tr")
        row.innerHTML = transaction.status != "pago" ?
            `
            <td>${formatDate(transaction.created_at)}</td>
            <td>${getTransactionTypeBadge(transaction.type)}</td>
            <td>${getCategoryLabel(transaction.category)}</td>
            <td>${transaction.description}</td>
            <td>${transaction.customer_name || "-"}</td>
            <td class="${transaction.type === "entrada" ? "text-success" : "text-danger"}">
                ${transaction.type === "entrada" ? "+" : "-"}${formatCurrency(transaction.amount)}
            </td>
            <td>${getStatusBadge(transaction.status)}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm update-transaction-btn" data-transaction-id="${transaction.id}">
                    Pago
                </button>
            </td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item edit-transaction" href="#" data-transaction-id="${transaction.id}"><i class="bi bi-pencil me-2"></i>Editar</a></li>
                        <li><a class="dropdown-item delete-transaction text-danger" href="#" data-transaction-id="${transaction.id}"><i class="bi bi-trash me-2"></i>Excluir</a></li>
                    </ul>
                </div>
            </td>
        `
            :
            `
            <td>${formatDate(transaction.created_at)}</td>
            <td>${getTransactionTypeBadge(transaction.type)}</td>
            <td>${getCategoryLabel(transaction.category)}</td>
            <td>${transaction.description}</td>
            <td>${transaction.customer_name || "-"}</td>
            <td class="${transaction.type === "entrada" ? "text-success" : "text-danger"}">
                ${transaction.type === "entrada" ? "+" : "-"}${formatCurrency(transaction.amount)}
            </td>
            <td>${getStatusBadge(transaction.status)}</td>
            <td>
                <button class="btn btn-outline-light btn-sm" disabled">
                    Pago
                </button>
            </td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item edit-transaction" href="#" data-transaction-id="${transaction.id}"><i class="bi bi-pencil me-2"></i>Editar</a></li>
                        <li><a class="dropdown-item delete-transaction text-danger" href="#" data-transaction-id="${transaction.id}"><i class="bi bi-trash me-2"></i>Excluir</a></li>
                    </ul>
                </div>
            </td>
        `
        tbody.appendChild(row)
    })
}

function updateIncomeTable() {
    const tbody = document.getElementById("incomeTable")
    tbody.innerHTML = ""

    const incomeTransactions = transactions.filter((t) => t.type === "entrada")
    incomeTransactions.forEach((transaction) => {
        const row = document.createElement("tr")
        row.innerHTML = `
            <td>${formatDate(transaction.created_at)}</td>
            <td>${getCategoryLabel(transaction.category)}</td>
            <td>${transaction.description}</td>
            <td>${transaction.customer_name || "-"}</td>
            <td class="text-success">+${formatCurrency(transaction.amount)}</td>
            <td>${getStatusBadge(transaction.status)}</td>
        `
        tbody.appendChild(row)
    })
}

function updateExpensesTable() {
    const tbody = document.getElementById("expensesTable")
    tbody.innerHTML = ""

    const expenseTransactions = transactions.filter((t) => t.type === "saida")
    expenseTransactions.forEach((transaction) => {
        const row = document.createElement("tr")
        row.innerHTML = `
            <td>${formatDate(transaction.created_at)}</td>
            <td>${getCategoryLabel(transaction.category)}</td>
            <td>${transaction.description}</td>
            <td class="text-danger">-${formatCurrency(transaction.amount)}</td>
            <td>${getStatusBadge(transaction.status)}</td>
        `
        tbody.appendChild(row)
    })
}

function updatePendingTable() {
    const tbody = document.getElementById("pendingTable")
    tbody.innerHTML = ""

    const pendingTransactions = transactions.filter((t) => t.status === "pendente")
    pendingTransactions.forEach((transaction) => {
        const row = document.createElement("tr")
        row.innerHTML = `
            <td>${formatDate(transaction.created_at)}</td>
            <td>${getCategoryLabel(transaction.category)}</td>
            <td>${transaction.description}</td>
            <td>${transaction.customer_name || "-"}</td>
            <td class="text-warning">${formatCurrency(transaction.amount)}</td>
            <td>${getStatusBadge(transaction.status)}</td>
        `
        tbody.appendChild(row)
    })
}

// Funções de filtro
function filterServices(searchTerm) {
    const rows = document.querySelectorAll("#servicesTable tr")
    rows.forEach((row) => {
        const text = row.textContent.toLowerCase()
        row.style.display = text.includes(searchTerm.toLowerCase()) ? "" : "none"
    })
}

function filterSales(searchTerm) {
    const rows = document.querySelectorAll("#salesTable tr")
    rows.forEach((row) => {
        const text = row.textContent.toLowerCase()
        row.style.display = text.includes(searchTerm.toLowerCase()) ? "" : "none"
    })
}

function filterStock() {
    const searchTerm = document.getElementById("stockSearch").value.toLowerCase()
    const categoryFilter = document.getElementById("stockCategoryFilter").value
    const rows = document.querySelectorAll("#stockTable tr")

    rows.forEach((row) => {
        const text = row.textContent.toLowerCase()
        const categoryCell = row.cells[1].textContent

        const matchesSearch = text.includes(searchTerm)
        const matchesCategory =
            categoryFilter === "all" || categoryCell.toLowerCase().includes(getCategoryLabel(categoryFilter).toLowerCase())

        row.style.display = matchesSearch && matchesCategory ? "" : "none"
    })
}

// Funções de modal
function toggleSaleFields(saleType) {
    const stockFields = document.getElementById("stockSaleFields")
    const externalFields = document.getElementById("externalSaleFields")

    if (saleType === "stock") {
        stockFields.style.display = "block"
        externalFields.style.display = "none"
    } else {
        stockFields.style.display = "none"
        externalFields.style.display = "block"
    }
}

function loadPartsOptions() {
    const partSelect = document.getElementById("partSelect")
    partSelect.innerHTML = '<option value="">Selecione uma peça para adicionar</option>'

    const parts = stock.filter((item) => item.category !== "aparelho")

    parts.forEach((part) => {
        const option = document.createElement("option")
        option.value = part.id
        option.textContent = `${part.name} - ${formatCurrency(part.sale_price)}`
        partSelect.appendChild(option)
    })
}

function loadStockDevices() {
    const deviceSelect = document.getElementById("stockDeviceSelect")
    deviceSelect.innerHTML = '<option value="">Selecione um aparelho</option>'

    const devices = stock.filter((item) => item.category === "aparelho" && item.quantity > 0)
    devices.forEach((device) => {
        const option = document.createElement("option")
        option.value = device.id
        option.textContent = `${device.name} - ${formatCurrency(device.sale_price)} (${device.quantity} disponível)`
        deviceSelect.appendChild(option)
    })
}

// Funções de salvamento
async function saveService() {
    try {
        // Validação dos campos obrigatórios
        const customerName = document.getElementById("customerName").value.trim();
        const customerPhone = document.getElementById("customerPhone").value.trim();
        const device = document.getElementById("device").value.trim();
        const problem = document.getElementById("problem").value.trim();
        const serviceValueInput = document.getElementById("serviceValue").value.trim();
        const deliveryDate = document.getElementById("deliveryDate").value;

        let sale_price = 0;

        // Verificar se o formulário HTML é válido primeiro
        const form = document.getElementById("serviceForm");
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Verificações adicionais para campos que não têm required no HTML
        if (!deliveryDate) {
            document.getElementById("deliveryDate").focus();
            return;
        }

        // Validar e converter valor
        const serviceValue = Number.parseFloat(serviceValueInput);
        if (isNaN(serviceValue) || serviceValue <= 0) {
            document.getElementById("serviceValue").focus();
            return;
        }

        // Validar peças selecionadas (se houver)
        if (selectedParts && selectedParts.length > 0) {
            for (const part of selectedParts) {
                const stockItem = stock.find((item) => item.id == part.id);
                sale_price = stockItem.sale_price;
                if (!stockItem) {
                    console.log(`Peça não encontrada no estoque`);
                    return;
                }

                if (stockItem.quantity < part.quantity) {
                    console.log(`Estoque insuficiente para a peça ${stockItem.name}. Disponível: ${stockItem.quantity}, Solicitado: ${part.quantity}`);
                    return;
                }
            }
        }

        const serviceData = {
            customerName: customerName,
            customerPhone: customerPhone,
            device: device,
            problem: problem,
            value: serviceValue + sale_price,
            deliveryDate: deliveryDate,
            notes: document.getElementById("serviceNotes").value.trim() || "",
            usedParts: selectedParts || [],
        }

        const newService = await db.createService(serviceData)
        services.unshift(newService)

        // Criar transação
        await db.createTransaction({
            type: "entrada",
            category: "servico",
            description: `${serviceData.problem} - ${serviceData.device}`,
            amount: serviceData.value,
            status: "pendente",
            customerName: serviceData.customerName,
        })

        // Atualizar estoque se peças foram usadas
        if (selectedParts && selectedParts.length > 0) {
            for (const part of selectedParts) {
                const stockItem = stock.find((item) => item.id == part.id)
                if (stockItem) {
                    const newQuantity = stockItem.quantity - part.quantity
                    await db.updateStockQuantity(part.id, newQuantity, `Usado em serviço #${newService.id}`)
                    stockItem.quantity = newQuantity
                }
            }
        }

        // Limpar formulário
        document.getElementById("serviceForm").reset()
        selectedParts = []
        document.getElementById("selectedParts").innerHTML = ""

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("serviceModal"))
        modal.hide()

        // Atualizar dados
        await loadAllData()
        updateDashboard()

    } catch (error) {
        console.error("Error saving service:", error)

        // Tratamento específico de diferentes tipos de erro
        let errorMessage = "Erro ao cadastrar serviço. Tente novamente.";

        if (error.message) {
            if (error.message.includes("Invalid input data")) {
                errorMessage = "Dados inválidos. Verifique se todos os campos obrigatórios estão preenchidos corretamente.";
            } else if (error.message.includes("Network") || error.message.includes("fetch")) {
                errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
            } else if (error.message.includes("Database") || error.message.includes("database")) {
                errorMessage = "Erro no banco de dados. Tente novamente em alguns instantes.";
            } else if (error.message.includes("400")) {
                errorMessage = "Dados inválidos. Verifique se todos os campos estão preenchidos corretamente.";
            }
        }

        console.log(errorMessage);
    }
}

async function saveSale() {
    try {
        const saleType = document.querySelector('input[name="saleType"]:checked').value
        let saleData

        // Verificar se o formulário HTML é válido primeiro
        const form = document.getElementById("saleForm");
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (saleType === "stock") {
            const stockItemId = document.getElementById("stockDeviceSelect").value
            const stockItem = stock.find((item) => item.id == stockItemId)

            if (!stockItem) {
                document.getElementById("stockDeviceSelect").focus()
                return
            }

            saleData = {
                device: stockItem.name,
                brand: stockItem.brand,
                model: stockItem.model,
                storage: stockItem.storage,
                state: stockItem.state,
                purchasePrice: stockItem.purchase_price,
                salePrice: stockItem.sale_price,
                profit: stockItem.sale_price - stockItem.purchase_price,
                customerName: document.getElementById("saleCustomerName").value,
                notes: document.getElementById("saleNotes").value,
                stockItemId: stockItemId,
            }

            // Atualizar estoque
            const newQuantity = stockItem.quantity - 1
            await db.updateStockQuantity(stockItemId, newQuantity, "Venda")
            stockItem.quantity = newQuantity
        } else {
            const purchasePrice = Number.parseFloat(document.getElementById("purchasePrice").value)
            const salePrice = Number.parseFloat(document.getElementById("salePrice").value)

            saleData = {
                device: `${document.getElementById("brand").value} ${document.getElementById("model").value}`,
                brand: document.getElementById("brand").value,
                model: document.getElementById("model").value,
                storage: document.getElementById("storage").value,
                condition: document.getElementById("condition").value,
                purchasePrice: purchasePrice,
                salePrice: salePrice,
                profit: salePrice - purchasePrice,
                customerName: document.getElementById("saleCustomerName").value,
                notes: document.getElementById("saleNotes").value,
            }
        }

        const newSale = await db.createSale(saleData)
        sales.unshift(newSale)

        // Criar transação
        await db.createTransaction({
            type: "entrada",
            category: "venda",
            description: `Venda ${saleData.device}`,
            amount: saleData.salePrice,
            status: "pago",
            customerName: saleData.customerName,
        })

        // Limpar formulário
        document.getElementById("saleForm").reset()
        toggleSaleFields("stock")

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("saleModal"))
        modal.hide()

        // Atualizar dados
        await loadAllData()
        updateDashboard()

    } catch (error) {
        console.error("Error saving sale:", error)
    }
}

async function saveTransaction() {
    try {
        const form = document.getElementById("transactionForm");
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const type = document.getElementById("type").value
        const category = document.getElementById("transactionCategory").value
        const description = document.getElementById("transactionDescription").value
        const customerName = document.getElementById("transactionCustomerName").value
        const valueInput = Number.parseFloat(document.getElementById("value").value) || 0

        const value = Number.parseFloat(valueInput);
        if (isNaN(value) || value <= 0) {
            console.log("Quantidade deve ser um número válido maior que zero");
            document.getElementById("value").focus();
            return;
        }

        // Preparar dados da transação
        const transactionData = {
            type: type,
            category: category,
            description: description || `${category.charAt(0).toUpperCase() + category.slice(1)}`,
            amount: value,
            status: "pago",
            customerName: customerName || null,
        }

        // Criar transação no banco
        const newTransaction = await db.createTransaction(transactionData)

        // Adicionar à lista local (se existir)
        if (typeof transactions !== 'undefined') {
            transactions.unshift(newTransaction)
        }

        // Limpar formulário
        document.getElementById("transactionForm").reset()

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("transactionModal"))
        modal.hide()

        // Atualizar dados na tela
        await loadAllData()
        updateDashboard()

    } catch (error) {
        console.error("Error saving transaction:", error)
    }
}

async function saveStock() {
    try {
        const saveBtn = document.getElementById("saveStockBtn");
        const stockId = saveBtn.getAttribute('data-stock-id');

        // Se existe stockId, é uma edição
        if (stockId) {
            return await updateStockData(stockId);
        }

        // Verificar se o formulário HTML é válido primeiro
        const form = document.getElementById("stockForm");
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const name = document.getElementById("itemName").value.trim();
        const code = document.getElementById("itemCode").value;
        const category = document.getElementById("category").value;
        const state = document.getElementById("state").value;
        const quantityInput = document.getElementById("quantity").value.trim();
        const purchasePriceStock = document.getElementById("purchasePriceStock").value.trim();
        const salePriceInput = document.getElementById("salePriceStock").value.trim();
        const notes = document.getElementById("stockNotes").value;

        // Validar quantidade
        const quantity = Number.parseInt(quantityInput);
        if (isNaN(quantity) || quantity < 0) {
            console.log("Quantidade deve ser um número válido maior ou igual a zero");
            document.getElementById("quantity").focus();
            return;
        }

        // Validar preço de custo e venda
        const salePrice = Number.parseFloat(salePriceInput);
        if (isNaN(salePrice) || salePrice < 0) {
            console.log("Preço de venda deve ser um número válido maior ou igual a zero");
            document.getElementById("salePriceStock").focus();
            return;
        }
        const purchasePrice = Number.parseFloat(purchasePriceStock);
        if (isNaN(purchasePrice) || purchasePrice < 0) {
            console.log("Preço de custo deve ser um número válido maior ou igual a zero");
            document.getElementById("purchasePriceStock").focus();
            return;
        }

        const stockData = {
            name: name,
            code: code,
            category: category,
            state: state,
            quantity: quantity,
            salePrice: salePrice,
            purchasePrice: purchasePrice,
            notes: notes,
        }

        const newItem = await db.createStockItem(stockData)
        stock.push(newItem)

        // Limpar formulário
        document.getElementById("stockForm").reset()

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("stockModal"))
        modal.hide()

        // Atualizar dados
        updateStockTable()
        loadPartsOptions()
        loadStockDevices()
        updateDashboard()

        console.log("Item cadastrado com sucesso!")

    } catch (error) {
        console.error("Error saving stock item:", error)

        // Tratamento específico de diferentes tipos de erro
        let errorMessage = "Erro ao cadastrar item. Tente novamente.";

        if (error.message) {
            if (error.message.includes("Invalid input data")) {
                errorMessage = "Dados inválidos. Verifique se todos os campos obrigatórios estão preenchidos corretamente.";
            } else if (error.message.includes("Network") || error.message.includes("fetch")) {
                errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
            } else if (error.message.includes("Database") || error.message.includes("database")) {
                errorMessage = "Erro no banco de dados. Tente novamente em alguns instantes.";
            } else if (error.message.includes("400")) {
                errorMessage = "Dados inválidos. Verifique se todos os campos estão preenchidos corretamente.";
            }
        }

        console.error(errorMessage);
    }
}

// Funções de atualização
async function updateServiceStatus(serviceId, newStatus) {
    try {
        await db.updateService(serviceId, { status: newStatus })

        const service = services.find((s) => s.id == serviceId)
        if (service) {
            service.status = newStatus

            // Se o serviço foi entregue, atualizar transação para pago
            if (newStatus === "Entregue") {
                const transaction = transactions.find(
                    (t) => t.customer_name === service.customer_name && t.amount === service.value && t.status === "pendente",
                )
                if (transaction) {
                    await db.updateTransaction(transaction.id)
                    transaction.status = "pago"
                }
            }
        }

        // Atualizar dados
        await loadAllData()
        updateDashboard()
    } catch (error) {
        console.error("Error updating service status:", error)
    }
}

async function updateTransactionStatus(transactionId) {
    try {
        await db.updateTransactionStatus(transactionId)

        // Atualizar dados
        await loadAllData()
        updateDashboard()
    } catch (error) {
        console.error("Error updating service status:", error)
    }
}

function openStockUpdateModal(itemId) {
    const item = stock.find((s) => s.id == itemId)
    if (!item) return

    document.getElementById("updateItemId").value = itemId
    document.getElementById("currentQuantityInfo").textContent = `Quantidade atual: ${item.quantity} unidades`

    const modal = new bootstrap.Modal(document.getElementById("stockUpdateModal"))
    modal.show()
}

async function updateStock() {
    try {
        const itemId = document.getElementById("updateItemId").value
        const movementType = document.getElementById("movementType").value
        const quantityInput = Number.parseInt(document.getElementById("movementQuantity").value)
        const reason = document.getElementById("movementReason").value

        const item = stock.find((s) => s.id == itemId)
        if (!item) return

        const quantity = Number.parseFloat(quantityInput)
        if (isNaN(quantity) || quantity < 0) {
            console.log("quantidade deve ser maior ou igual a zero.")
            document.getElementById("movementQuantity").focus();
            return;
        }
        const newQuantity = movementType === "add" ? item.quantity + quantity : Math.max(0, item.quantity - quantity)

        await db.updateStockQuantity(itemId, newQuantity, reason)
        item.quantity = newQuantity

        // Limpar formulário
        document.getElementById("stockUpdateForm").reset()

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("stockUpdateModal"))
        modal.hide()

        // Atualizar dados
        updateStockTable()
        updateDashboard()

    } catch (error) {
        console.error("Error updating stock:", error)
    }
}

function generateServicePDF(serviceId) {
    try {
        // Encontrar o serviço
        const service = services.find(s => s.id == serviceId);
        if (!service) {
            console.log('Serviço não encontrado');
            return;
        }

        // Informações da empresa
        const companyInfo = {
            name: 'ASSISTÊNCIA TÉCNICA',
            subtitle: 'Serviços especializados em smartphones',
            phone: '(27) 99999-9999',
            email: 'contato@assistencia.com',
            address: 'São Mateus - ES'
        };

        // Criar elemento temporário para conversão HTML
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '210mm';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.fontSize = '12px';
        tempDiv.style.lineHeight = '1.4';
        tempDiv.style.backgroundColor = 'white';

        // Conteúdo HTML para o PDF
        tempDiv.innerHTML = generatePDFContent(service, companyInfo);

        // Adicionar ao DOM temporariamente
        document.body.appendChild(tempDiv);

        // Configurações do jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Usar html2canvas para converter HTML em imagem e depois para PDF
        html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Adicionar páginas extras se necessário
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Remover elemento temporário
            document.body.removeChild(tempDiv);

            // Salvar o PDF
            const fileName = `OS_${serviceId}_${service.customer_name.replace(/\s+/g, '_')}.pdf`;
            doc.save(fileName);

        }).catch(error => {
            console.error('Erro ao converter HTML para PDF:', error);
            // Fallback: usar método anterior se html2canvas falhar
            generatePDFClassic(service, companyInfo, serviceId);
            document.body.removeChild(tempDiv);
        });

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
    }
}

// Função para editar serviço
function updateService(serviceId) {
    try {
        // Encontrar o serviço
        const service = services.find(s => s.id == serviceId);
        if (!service) {
            console.log('Serviço não encontrado');
            return;
        }

        // Alterar o título do modal
        document.querySelector('#serviceModal .modal-title').textContent = 'Editar Serviço';
        document.getElementById('saveServiceBtn').textContent = 'Atualizar Serviço';

        // Preencher os campos do formulário com os dados do serviço
        document.getElementById('customerName').value = service.customer_name || '';
        document.getElementById('customerPhone').value = service.customer_phone || '';
        document.getElementById('device').value = service.device || '';
        document.getElementById('serviceValue').value = service.value || '';
        document.getElementById('problem').value = service.problem || '';
        document.getElementById('deliveryDate').value = service.delivery_date || '';
        document.getElementById('serviceNotes').value = service.notes || '';

        // Limpar peças selecionadas anteriormente
        document.getElementById('selectedParts').innerHTML = '';

        // Se houver peças utilizadas, adicionar elas
        if (service.used_parts && service.used_parts.length > 0) {
            service.used_parts.forEach((part, index) => {
                addPartToService(part, index);
            });
        }

        // Adicionar atributo data-service-id ao botão de salvar para identificar que é uma edição
        document.getElementById('saveServiceBtn').setAttribute('data-service-id', serviceId);

        // Abrir o modal
        const modal = new bootstrap.Modal(document.getElementById('serviceModal'));
        modal.show();

    } catch (error) {
        console.error('Erro ao carregar dados do serviço:', error);
    }
}

// Função para excluir serviço
async function deleteService(serviceId) {
    try {
        // Encontrar o serviço
        const service = services.find(s => s.id == serviceId);
        if (!service) {
            console.log('Serviço não encontrado');
            return;
        }

        // Criar modal de confirmação personalizado
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal fade';
        confirmModal.id = 'deleteConfirmModal';
        confirmModal.setAttribute('tabindex', '-1');

        confirmModal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Confirmar Exclusão
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-3">
                            <i class="bi bi-trash text-danger" style="font-size: 3rem;"></i>
                        </div>
                        <h6 class="text-center mb-3">Tem certeza que deseja excluir este serviço?</h6>
                        <p class="text-muted small mb-0">
                            <i class="bi bi-info-circle me-1"></i>
                            Esta ação não pode ser desfeita. Todos os dados relacionados a este serviço serão permanentemente removidos.
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-danger" id="confirmDeleteBtn" data-service-id="${serviceId}">Excluir</button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar modal ao DOM
        document.body.appendChild(confirmModal);

        // Criar instância do modal Bootstrap
        const modal = new bootstrap.Modal(confirmModal);

        // Event listener para o botão de confirmação
        document.getElementById('confirmDeleteBtn').addEventListener('click', async function () {
            const serviceIdToDelete = this.getAttribute('data-service-id');

            // Desabilitar o botão e mostrar loading
            const deleteBtn = this;
            const originalText = deleteBtn.innerHTML;
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<i class="spinner-border spinner-border-sm me-1"></i>Excluindo...';

            try {
                // Chamar a função do banco de dados
                await db.deleteService(serviceIdToDelete);

                // Encontrar o índice do serviço no array local
                const serviceIndex = services.findIndex(s => s.id == serviceIdToDelete);

                if (serviceIndex !== -1) {
                    // Remover o serviço do array local
                    const deletedService = services.splice(serviceIndex, 1)[0];

                    // Atualizar dados
                    await loadAllData()
                    updateDashboard()

                    // Fechar o modal
                    modal.hide();

                    updateDashboard()

                    // Mostrar mensagem de sucesso
                    showSuccessMessage(`Serviço OS #${deletedService.id} excluído com sucesso!`);
                }

            } catch (error) {
                console.error('Erro ao excluir serviço:', error);

                // Reabilitar o botão
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = originalText;
            }
        });

        // Event listener para remover o modal do DOM quando fechado
        confirmModal.addEventListener('hidden.bs.modal', function () {
            document.body.removeChild(confirmModal);
        });

        // Abrir o modal
        modal.show();

    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
    }
}

// Função auxiliar para mostrar mensagem de sucesso
function showSuccessMessage(message) {
    // Verificar se já existe um alert de sucesso
    const existingAlert = document.querySelector('.alert-success-custom');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Criar elemento de alerta
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show alert-success-custom';
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';

    alertDiv.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Adicionar ao body
    document.body.appendChild(alertDiv);

    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (alertDiv && alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function generateServicePrint(serviceId) {
    try {
        // Encontrar o serviço
        const service = services.find(s => s.id == serviceId);
        if (!service) {
            alert('Serviço não encontrado');
            return;
        }

        // Informações da empresa (mesmas do PDF)
        const companyInfo = {
            name: 'ASSISTÊNCIA TÉCNICA',
            subtitle: 'Serviços especializados em smartphones',
            phone: '(27) 99999-9999',
            email: 'contato@assistencia.com',
            address: 'São Mateus - ES'
        };

        // Criar uma nova janela para impressão
        const printWindow = window.open('', '_blank', 'width=800,height=600');

        // Conteúdo HTML para impressão
        const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ordem de Serviço #${service.id}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    font-size: 12px;
                    line-height: 1.4;
                }
                .header {
                    background-color: #337ab7;
                    color: white;
                    padding: 15px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                }
                .company-info h1 {
                    margin: 0;
                    font-size: 20px;
                }
                .company-info p {
                    margin: 5px 0;
                    font-size: 12px;
                }
                .contact-info {
                    text-align: right;
                    font-size: 10px;
                }
                .os-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #ccc;
                }
                .os-info h2 {
                    margin: 0;
                    color: #333;
                }
                .section {
                    margin-bottom: 20px;
                }
                .section h3 {
                    background-color: #f8f9fa;
                    padding: 8px;
                    margin: 0 0 10px 0;
                    border-left: 3px solid #337ab7;
                    font-size: 14px;
                }
                .info-box {
                    border: 1px solid #ddd;
                    padding: 10px;
                    background-color: #fafafa;
                }
                .parts-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                .parts-table th,
                .parts-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                .parts-table th {
                    background-color: #f0f0f0;
                }
                .signature-area {
                    margin-top: 40px;
                    display: flex;
                    justify-content: space-between;
                }
                .signature-box {
                    width: 200px;
                    text-align: center;
                }
                .signature-line {
                    border-top: 1px solid #333;
                    margin-bottom: 5px;
                    height: 40px;
                }
                .terms {
                    margin-top: 30px;
                    font-size: 10px;
                }
                .terms ul {
                    margin: 5px 0;
                    padding-left: 15px;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 10px;
                    color: #666;
                    border-top: 1px solid #ccc;
                    padding-top: 10px;
                }
                @media print {
                    body {
                        margin: 0;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-info">
                    <h1>${companyInfo.name}</h1>
                    <p>${companyInfo.subtitle}</p>
                </div>
                <div class="contact-info">
                    <p>Tel: ${companyInfo.phone}</p>
                    <p>Email: ${companyInfo.email}</p>
                    <p>${companyInfo.address}</p>
                </div>
            </div>

            <div class="os-info">
                <div>
                    <h2>ORDEM DE SERVIÇO</h2>
                </div>
                <div>
                    <p><strong>OS Nº:</strong> #${service.id}</p>
                    <p><strong>Data:</strong> ${formatDate(service.created_at || new Date())}</p>
                </div>
            </div>

            <div class="section">
                <h3>DADOS DO CLIENTE</h3>
                <div class="info-box">
                    <p><strong>Nome:</strong> ${service.customer_name}</p>
                    <p><strong>Telefone:</strong> ${service.customer_phone}</p>
                    <p><strong>Aparelho:</strong> ${service.device}</p>
                </div>
            </div>

            <div class="section">
                <h3>DESCRIÇÃO DO PROBLEMA</h3>
                <div class="info-box">
                    <p>${service.problem}</p>
                </div>
            </div>

            <div class="section">
                <h3>INFORMAÇÕES DO SERVIÇO</h3>
                <div class="info-box">
                    <p><strong>Valor do Serviço:</strong> R$ ${(service.value || 0).toFixed(2)}</p>
                    <p><strong>Data de Entrega Prevista:</strong> ${service.delivery_date ? formatDate(service.delivery_date) : 'A definir'}</p>
                    <p><strong>Status:</strong> ${service.status}</p>
                    ${service.notes ? `<p><strong>Observações:</strong> ${service.notes}</p>` : ''}
                </div>
            </div>

            <div class="terms">
                <h3>TERMOS E CONDIÇÕES</h3>
                <ul>
                    <li>O prazo de entrega pode ser alterado em caso de necessidade de importação de peças.</li>
                    <li>O cliente tem 90 dias de garantia para defeitos relacionados ao serviço executado.</li>
                    <li>Equipamentos não retirados em até 90 dias serão considerados abandonados.</li>
                    <li>A empresa não se responsabiliza por dados perdidos durante o reparo.</li>
                </ul>
            </div>

            <br/><br/>

            <div class="signature-area">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p>Assinatura do Cliente</p>
                    <p>Data: ____/____/______</p>
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p>Assinatura do Técnico</p>
                    <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <div class="footer">
                <p>Este documento foi gerado automaticamente pelo sistema de gestão.</p>
                <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>

            <div class="no-print" style="margin-top: 20px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; background-color: #337ab7; color: white; border: none; cursor: pointer;">
                    Imprimir
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; background-color: #6c757d; color: white; border: none; cursor: pointer; margin-left: 10px;">
                    Fechar
                </button>
            </div>
        </body>
        </html>
        `;

        // Escrever o conteúdo na nova janela
        printWindow.document.write(printContent);
        printWindow.document.close();

        // Aguardar o carregamento e abrir a caixa de diálogo de impressão
        printWindow.onload = function () {
            setTimeout(() => {
                printWindow.print();
            }, 250);
        };

    } catch (error) {
        console.error('Erro ao gerar impressão:', error);
        alert('Erro ao gerar impressão do serviço');
    }
}

async function updateSale(saleId) {
    try {
        const sale = sales.find(s => s.id == saleId);
        if (!sale) {
            alert('Venda não encontrada');
            return;
        }

        // Alterar o título do modal
        document.querySelector('#saleModal .modal-title').textContent = 'Editar Venda';
        document.getElementById('saveSaleBtn').textContent = 'Atualizar Venda';

        // Preencher os campos do formulário
        if (sale.stock_item_id) {
            document.getElementById('stockSale').checked = true;
            document.getElementById('stockDeviceSelect').value = sale.stock_item_id;
            toggleSaleFields('stock');
        } else {
            document.getElementById('externalSale').checked = true;
            document.getElementById('brand').value = sale.brand || '';
            document.getElementById('model').value = sale.model || '';
            document.getElementById('storage').value = sale.storage || '';
            document.getElementById('condition').value = sale.condition || '';
            document.getElementById('purchasePrice').value = sale.purchase_price || '';
            document.getElementById('salePrice').value = sale.sale_price || '';
            toggleSaleFields('external');
        }

        document.getElementById('saleCustomerName').value = sale.customer_name || '';
        document.getElementById('saleNotes').value = sale.notes || '';

        // Adicionar atributo para identificar que é uma edição
        document.getElementById('saveSaleBtn').setAttribute('data-sale-id', saleId);

        // Abrir o modal
        const modal = new bootstrap.Modal(document.getElementById('saleModal'));
        modal.show();

    } catch (error) {
        console.error('Erro ao carregar dados da venda:', error);
        alert('Erro ao carregar dados da venda');
    }
}

async function deleteSale(saleId) {
    try {
        const sale = sales.find(s => s.id == saleId);
        if (!sale) {
            alert('Venda não encontrada');
            return;
        }

        const confirmModal = createConfirmModal(
            'Confirmar Exclusão de Venda',
            `Tem certeza que deseja excluir a venda do ${sale.device}?`,
            'Esta ação não pode ser desfeita. A venda será permanentemente removida do histórico.',
            async () => {
                await db.deleteSale(saleId);
                const saleIndex = sales.findIndex(s => s.id == saleId);
                if (saleIndex !== -1) {
                    sales.splice(saleIndex, 1);
                    updateSalesTable();
                    updateDashboard();
                    showSuccessMessage(`Venda #${saleId} excluída com sucesso!`);
                }
            }
        );

    } catch (error) {
        console.error('Erro ao excluir venda:', error);
        alert('Erro ao excluir venda');
    }
}

// Funções para ESTOQUE
async function updateStockItem(stockId) {
    try {
        const item = stock.find(s => s.id == stockId);
        if (!item) {
            alert('Item não encontrado');
            return;
        }

        // Alterar o título do modal
        document.querySelector('#stockModal .modal-title').textContent = 'Editar Item';
        document.getElementById('saveStockBtn').textContent = 'Atualizar Item';

        // Preencher os campos do formulário
        document.getElementById('itemName').value = item.name || '';
        document.getElementById('itemCode').value = item.code || '';
        document.getElementById('category').value = item.category || '';
        document.getElementById('state').value = item.state || '';
        document.getElementById('quantity').value = item.quantity || '';
        document.getElementById('purchasePriceStock').value = item.purchase_price || '';
        document.getElementById('salePriceStock').value = item.sale_price || '';
        document.getElementById('stockNotes').value = item.notes || '';

        // Adicionar atributo para identificar que é uma edição
        document.getElementById('saveStockBtn').setAttribute('data-stock-id', stockId);

        // Abrir o modal
        const modal = new bootstrap.Modal(document.getElementById('stockModal'));
        modal.show();

    } catch (error) {
        console.error('Erro ao carregar dados do item:', error);
        alert('Erro ao carregar dados do item');
    }
}

async function updateStockData(stockId) {
    try {
        // Verificar se o formulário HTML é válido primeiro
        const form = document.getElementById("stockForm");
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const name = document.getElementById("itemName").value.trim();
        const code = document.getElementById("itemCode").value;
        const category = document.getElementById("category").value;
        const state = document.getElementById("state").value;
        const quantityInput = document.getElementById("quantity").value.trim();
        const purchasePriceStock = document.getElementById("purchasePriceStock").value.trim();
        const salePriceInput = document.getElementById("salePriceStock").value.trim();
        const notes = document.getElementById("stockNotes").value;

        // Validar quantidade
        const quantity = Number.parseInt(quantityInput);
        if (isNaN(quantity) || quantity < 0) {
            console.log("Quantidade deve ser um número válido maior ou igual a zero");
            document.getElementById("quantity").focus();
            return;
        }

        // Validar preço de custo e venda
        const salePrice = Number.parseFloat(salePriceInput);
        if (isNaN(salePrice) || salePrice < 0) {
            console.log("Preço de venda deve ser um número válido maior ou igual a zero");
            document.getElementById("salePriceStock").focus();
            return;
        }
        const purchasePrice = Number.parseFloat(purchasePriceStock);
        if (isNaN(purchasePrice) || purchasePrice < 0) {
            console.log("Preço de custo deve ser um número válido maior ou igual a zero");
            document.getElementById("purchasePriceStock").focus();
            return;
        }

        const stockData = {
            id: stockId,
            name: name,
            code: code,
            category: category,
            state: state,
            quantity: quantity,
            sale_price: salePrice,
            purchase_price: purchasePrice,
            notes: notes,
        }

        // Atualizar no banco de dados
        const updatedItem = await db.updateStockItem(stockId, stockData);

        // Atualizar no array local
        const index = stock.findIndex(item => item.id == stockId);
        if (index !== -1) {
            stock[index] = updatedItem;
        }

        // Limpar formulário
        document.getElementById("stockForm").reset();

        // Resetar o botão para o estado de criação
        const saveBtn = document.getElementById("saveStockBtn");
        saveBtn.textContent = 'Salvar Item';
        saveBtn.removeAttribute('data-stock-id');

        // Resetar título do modal
        document.querySelector('#stockModal .modal-title').textContent = 'Novo Item';

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("stockModal"));
        modal.hide();

        // Atualizar dados
        updateStockTable();
        loadPartsOptions();
        loadStockDevices();
        updateDashboard();

        console.log("Item atualizado com sucesso!");

    } catch (error) {
        console.error("Error updating stock item:", error);

        // Tratamento específico de diferentes tipos de erro
        let errorMessage = "Erro ao atualizar item. Tente novamente.";

        if (error.message) {
            if (error.message.includes("Invalid input data")) {
                errorMessage = "Dados inválidos. Verifique se todos os campos obrigatórios estão preenchidos corretamente.";
            } else if (error.message.includes("Network") || error.message.includes("fetch")) {
                errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
            } else if (error.message.includes("Database") || error.message.includes("database")) {
                errorMessage = "Erro no banco de dados. Tente novamente em alguns instantes.";
            } else if (error.message.includes("400")) {
                errorMessage = "Dados inválidos. Verifique se todos os campos estão preenchidos corretamente.";
            } else if (error.message.includes("404")) {
                errorMessage = "Item não encontrado. Pode ter sido removido por outro usuário.";
            }
        }

        console.error(errorMessage);
    }
}

async function deleteStockItem(stockId) {
    try {
        const item = stock.find(s => s.id == stockId);
        if (!item) {
            alert('Item não encontrado');
            return;
        }

        const confirmModal = createConfirmModal(
            'Confirmar Exclusão de Item',
            `Tem certeza que deseja excluir o item "${item.name}"?`,
            'Esta ação não pode ser desfeita. O item será permanentemente removido do estoque.',
            async () => {
                await db.deleteStockItem(stockId);
                const itemIndex = stock.findIndex(s => s.id == stockId);
                if (itemIndex !== -1) {
                    stock.splice(itemIndex, 1);
                    updateStockTable();
                    loadPartsOptions();
                    loadStockDevices();
                    updateDashboard();
                    showSuccessMessage(`Item "${item.name}" excluído com sucesso!`);
                }
            }
        );

    } catch (error) {
        console.error('Erro ao excluir item:', error);
        alert('Erro ao excluir item');
    }
}

// Funções para TRANSAÇÕES
async function updateTransactionItem(transactionId) {
    try {
        const transaction = transactions.find(t => t.id == transactionId);
        if (!transaction) {
            alert('Transação não encontrada');
            return;
        }

        // Alterar o título do modal
        document.querySelector('#transactionModal .modal-title').textContent = 'Editar Transação';
        document.getElementById('saveTransactionBtn').textContent = 'Atualizar Transação';

        // Preencher os campos do formulário
        document.getElementById('type').value = transaction.type || '';
        document.getElementById('transactionCategory').value = transaction.category || '';
        document.getElementById('transactionDescription').value = transaction.description || '';
        document.getElementById('transactionCustomerName').value = transaction.customer_name || '';
        document.getElementById('value').value = transaction.amount || '';

        // Adicionar atributo para identificar que é uma edição
        document.getElementById('saveTransactionBtn').setAttribute('data-transaction-id', transactionId);

        // Abrir o modal
        const modal = new bootstrap.Modal(document.getElementById('transactionModal'));
        modal.show();

    } catch (error) {
        console.error('Erro ao carregar dados da transação:', error);
        alert('Erro ao carregar dados da transação');
    }
}

async function deleteTransaction(transactionId) {
    try {
        const transaction = transactions.find(t => t.id == transactionId);
        if (!transaction) {
            alert('Transação não encontrada');
            return;
        }

        const confirmModal = createConfirmModal(
            'Confirmar Exclusão de Transação',
            `Tem certeza que deseja excluir a transação "${transaction.description}"?`,
            'Esta ação não pode ser desfeita. A transação será permanentemente removida do histórico financeiro.',
            async () => {
                await db.deleteTransaction(transactionId);
                const transactionIndex = transactions.findIndex(t => t.id == transactionId);
                if (transactionIndex !== -1) {
                    transactions.splice(transactionIndex, 1);
                    updateFinancialTables();
                    updateDashboard();
                    showSuccessMessage(`Transação #${transactionId} excluída com sucesso!`);
                }
            }
        );

    } catch (error) {
        console.error('Erro ao excluir transação:', error);
        alert('Erro ao excluir transação');
    }
}

// Função auxiliar para criar modal de confirmação reutilizável
function createConfirmModal(title, message, warning, onConfirm) {
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal fade';
    confirmModal.id = 'deleteConfirmModal_' + Date.now();
    confirmModal.setAttribute('tabindex', '-1');

    confirmModal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        ${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="text-center mb-3">
                        <i class="bi bi-trash text-danger" style="font-size: 3rem;"></i>
                    </div>
                    <h6 class="text-center mb-3">${message}</h6>
                    <p class="text-muted small mb-0">
                        <i class="bi bi-info-circle me-1"></i>
                        ${warning}
                    </p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteBtn_${Date.now()}">Excluir</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(confirmModal);
    const modal = new bootstrap.Modal(confirmModal);

    const confirmBtn = confirmModal.querySelector('.btn-danger');
    confirmBtn.addEventListener('click', async function () {
        const originalText = this.innerHTML;
        this.disabled = true;
        this.innerHTML = '<i class="spinner-border spinner-border-sm me-1"></i>Excluindo...';

        try {
            await onConfirm();
            modal.hide();
        } catch (error) {
            this.disabled = false;
            this.innerHTML = originalText;
            alert('Erro ao excluir. Tente novamente.');
        }
    });

    confirmModal.addEventListener('hidden.bs.modal', function () {
        document.body.removeChild(confirmModal);
    });

    modal.show();
    return modal;
}

// Funções auxiliares
// Função auxiliar para adicionar peça ao formulário
function addPartToService(part, index) {
    const selectedPartsDiv = document.getElementById('selectedParts');

    const partDiv = document.createElement('div');
    partDiv.className = 'border p-2 mb-2 rounded';
    partDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <strong>${part.name}</strong><br>
                <small>Qtd: ${part.quantity} | Preço: R$ ${part.salePrice ? part.salePrice.toFixed(2) : '0.00'}</small>
            </div>
            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">
                <i class="bi bi-trash"></i>
            </button>
        </div>
        <input type="hidden" name="partId[]" value="${part.id || part.partId}">
        <input type="hidden" name="partQuantity[]" value="${part.quantity}">
        <input type="hidden" name="partPrice[]" value="${part.salePrice || part.price}">
    `;

    selectedPartsDiv.appendChild(partDiv);
}

// Função para gerar conteúdo HTML do PDF
function generatePDFContent(service, companyInfo) {
    return `
        <div style="padding: 20px; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4;">
            <!-- Cabeçalho -->
            <div style="background-color: #337ab7; color: white; padding: 15px; margin-bottom: 20px; display: flex; justify-content: space-between;">
                <div>
                    <h1 style="margin: 0; font-size: 20px;">${companyInfo.name}</h1>
                    <p style="margin: 5px 0; font-size: 12px;">${companyInfo.subtitle}</p>
                </div>
                <div style="text-align: right; font-size: 10px;">
                    <p style="margin: 2px 0;">Tel: ${companyInfo.phone}</p>
                    <p style="margin: 2px 0;">Email: ${companyInfo.email}</p>
                    <p style="margin: 2px 0;">${companyInfo.address}</p>
                </div>
            </div>

            <!-- Informações da OS -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ccc;">
                <div>
                    <h2 style="margin: 0; color: #333; font-size: 16px;">ORDEM DE SERVIÇO</h2>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 2px 0;"><strong>OS Nº:</strong> #${service.id}</p>
                    <p style="margin: 2px 0;"><strong>Data:</strong> ${formatDate(service.created_at || new Date())}</p>
                </div>
            </div>

            <!-- Dados do Cliente -->
            <div style="margin-bottom: 20px;">
                <h3 style="background-color: #f8f9fa; padding: 8px; margin: 0 0 10px 0; border-left: 3px solid #337ab7; font-size: 14px;">DADOS DO CLIENTE</h3>
                <div style="border: 1px solid #ddd; padding: 10px; background-color: #fafafa;">
                    <p style="margin: 5px 0;"><strong>Nome:</strong> ${service.customer_name}</p>
                    <p style="margin: 5px 0;"><strong>Telefone:</strong> ${service.customer_phone}</p>
                    <p style="margin: 5px 0;"><strong>Aparelho:</strong> ${service.device}</p>
                </div>
            </div>

            <!-- Descrição do Problema -->
            <div style="margin-bottom: 20px;">
                <h3 style="background-color: #f8f9fa; padding: 8px; margin: 0 0 10px 0; border-left: 3px solid #337ab7; font-size: 14px;">DESCRIÇÃO DO PROBLEMA</h3>
                <div style="border: 1px solid #ddd; padding: 10px; background-color: #fafafa;">
                    <p style="margin: 5px 0;">${service.problem}</p>
                </div>
            </div>

            <!-- Informações do Serviço -->
            <div style="margin-bottom: 20px;">
                <h3 style="background-color: #f8f9fa; padding: 8px; margin: 0 0 10px 0; border-left: 3px solid #337ab7; font-size: 14px;">INFORMAÇÕES DO SERVIÇO</h3>
                <div style="border: 1px solid #ddd; padding: 10px; background-color: #fafafa;">
                    <p style="margin: 5px 0;"><strong>Valor do Serviço:</strong> R$ ${(service.value || 0).toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>Data de Entrega Prevista:</strong> ${service.delivery_date ? formatDate(service.delivery_date) : 'A definir'}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> ${service.status}</p>
                    ${service.notes ? `<p style="margin: 5px 0;"><strong>Observações:</strong> ${service.notes}</p>` : ''}
                </div>
            </div>

            <!-- Termos e Condições -->
            <div style="margin-bottom: 30px;">
                <h3 style="background-color: #f8f9fa; padding: 8px; margin: 0 0 10px 0; border-left: 3px solid #337ab7; font-size: 14px;">TERMOS E CONDIÇÕES</h3>
                <ul style="margin: 5px 0; padding-left: 15px; font-size: 10px;">
                    <li style="margin-bottom: 3px;">O prazo de entrega pode ser alterado em caso de necessidade de importação de peças.</li>
                    <li style="margin-bottom: 3px;">O cliente tem 90 dias de garantia para defeitos relacionados ao serviço executado.</li>
                    <li style="margin-bottom: 3px;">Equipamentos não retirados em até 90 dias serão considerados abandonados.</li>
                    <li style="margin-bottom: 3px;">A empresa não se responsabiliza por dados perdidos durante o reparo.</li>
                </ul>
            </div>

            <br/><br/>

            <!-- Área de Assinatura -->
            <div style="margin-top: 40px; display: flex; justify-content: space-between;">
                <div style="width: 200px; text-align: center;">
                    <div style="border-top: 1px solid #333; margin-bottom: 5px; height: 40px;"></div>
                    <p style="margin: 2px 0;">Assinatura do Cliente</p>
                    <p style="margin: 2px 0;">Data: ____/____/______</p>
                </div>
                <div style="width: 200px; text-align: center;">
                    <div style="border-top: 1px solid #333; margin-bottom: 5px; height: 40px;"></div>
                    <p style="margin: 2px 0;">Assinatura do Técnico</p>
                    <p style="margin: 2px 0;">Data: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <!-- Rodapé -->
            <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px;">
                <p style="margin: 2px 0;">Este documento foi gerado automaticamente pelo sistema de gestão.</p>
                <p style="margin: 2px 0;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    `;
}

// Função fallback para o método clássico do jsPDF (caso html2canvas falhe)
function generatePDFClassic(service, companyInfo, serviceId) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Configurações de cores
    const primaryColor = [51, 122, 183];
    const secondaryColor = [108, 117, 125];
    const textColor = [33, 37, 41];

    // Cabeçalho da empresa
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.name, 20, 15);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(companyInfo.subtitle, 20, 22);

    // Informações da empresa (lado direito do cabeçalho)
    doc.setFontSize(10);
    doc.text(`Tel: ${companyInfo.phone}`, 130, 15);
    doc.text(`Email: ${companyInfo.email}`, 130, 20);
    doc.text(`${companyInfo.address}`, 130, 25);

    // Continuar com o resto do método clássico...
    // (código similar ao original, mas mais compacto)

    const fileName = `OS_${serviceId}_${service.customer_name.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value || 0)
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("pt-BR")
}

function getStatusBadge(status) {
    const badges = {
        "Em andamento": '<span class="badge bg-primary">Em andamento</span>',
        "Aguardando peça": '<span class="badge bg-warning">Aguardando peça</span>',
        Pronto: '<span class="badge bg-success">Pronto</span>',
        Entregue: '<span class="badge bg-secondary">Entregue</span>',
        pago: '<span class="badge bg-success">Pago</span>',
        pendente: '<span class="badge bg-warning">Pendente</span>',
        vencido: '<span class="badge bg-danger">Vencido</span>',
    }
    return badges[status] || status
}

function getConditionBadge(condition) {
    const badges = {
        Novo: '<span class="badge bg-success">Novo</span>',
        Seminovo: '<span class="badge bg-primary">Seminovo</span>',
        Usado: '<span class="badge bg-warning">Usado</span>',
    }
    return badges[condition] || condition
}

function getTransactionTypeBadge(type) {
    const badges = {
        entrada: '<span class="badge bg-success">Entrada</span>',
        saida: '<span class="badge bg-danger">Saída</span>',
    }
    return badges[type] || type
}

function getCategoryLabel(category) {
    const labels = {
        tela: "Tela",
        bateria: "Bateria",
        carregador: "Carregador",
        cabo: "Cabo",
        fone: "Fone",
        capa: "Capa",
        pelicula: "Película",
        aparelho: "Aparelho",
        ferramenta: "Ferramenta",
        outros: "Outros",
        servico: "Serviço",
        venda: "Venda",
        despesa: "Despesa",
        compra: "Compra",
    }
    return labels[category] || category
}

function getStockStatusBadge(state) {
    if (state === 'usado') return '<span class="badge bg-warning">Semi novo</span>'
    if (state === 'novo') return '<span class="badge bg-success">Novo</span>'
}

// Adicionar peça ao serviço
document.getElementById("partSelect").addEventListener("change", function () {
    const partId = Number(this.value.trim())
    if (!partId) return

    const part = stock.find((item) => item.id == partId)
    if (!part) return

    const existingPart = selectedParts.find((p) => p.id == partId)

    if (existingPart) {
        existingPart.quantity += 1
    } else {
        selectedParts.push({
            id: part.id,
            name: part.name,
            quantity: 1,
            salePrice: part.sale_price,
        })
    }

    updateSelectedPartsDisplay()
    this.value = ""
})

function updateSelectedPartsDisplay() {
    const container = document.getElementById("selectedParts")

    if (selectedParts.length === 0) {
        container.innerHTML = ""
        return
    }

    const total = selectedParts.reduce((sum, part) => sum + part.quantity * part.salePrice, 0)

    container.innerHTML = `
        <div class="border rounded p-3">
            <p class="fw-bold mb-2">Peças selecionadas:</p>
            ${selectedParts
            .map(
                (part) => `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>${part.name} (x${part.quantity})</span>
                    <div class="d-flex align-items-center gap-2">
                        <span>${formatCurrency(part.quantity * part.salePrice)}</span>
                        <button type="button" class="btn btn-outline-danger btn-sm" data-part-id="${part.id}">
                            Remover
                        </button>
                    </div>
                </div>
            `,
            )
            .join("")}
            <div class="border-top pt-2 fw-bold">
                Total em peças: ${formatCurrency(total)}
            </div>
        </div>
    `
    container.querySelectorAll('button[data-part-id]').forEach(button => {
        button.addEventListener('click', function () {
            const partId = this.getAttribute('data-part-id')
            removePartFromService(partId)
        })
    })
}

function removePartFromService(partId) {
    selectedParts = selectedParts.filter((part) => part.id != partId)
    updateSelectedPartsDisplay()
}

function analyzeProfit(value) {
    if (value > 0) return `<p class="text-success">${formatCurrency(value)}</p>`
    return `<p class="text-danger">${formatCurrency(value)}</p>`
}

// Função para inicializar o PDV
function initializePDV() {
    loadProductsGrid()
    updateCartDisplay()
    updateTodaysSales()
    setupPDVEventListeners()
}

// Setup dos event listeners específicos do PDV
function setupPDVEventListeners() {
    // Busca de produtos
    const pdvSearch = document.getElementById("pdvSearch")
    if (pdvSearch) {
        pdvSearch.addEventListener("input", function () {
            filterProducts(this.value)
        })
    }

    // Campo de código (Enter para adicionar produto)
    const codeInput = document.getElementById("productCode")
    if (codeInput) {
        codeInput.focus() //manter sempre em foco
        codeInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                e.preventDefault()
                addProductByCode(this.value)
                this.value = ""
            }
        })
    }

    // Limpar carrinho
    const clearCartBtn = document.getElementById("clearCart")
    if (clearCartBtn) {
        clearCartBtn.addEventListener("click", clearCart)
    }

    // Desconto
    const discountInput = document.getElementById("discountPercent")
    if (discountInput) {
        discountInput.addEventListener("input", updateCartTotals)
    }

    // Finalizar venda
    const finalizeSaleBtn = document.getElementById("finalizeSale")
    if (finalizeSaleBtn) {
        finalizeSaleBtn.addEventListener("click", finalizeSale)
    }

    // Imprimir recibo
    const printReceiptBtn = document.getElementById("printReceipt")
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener("click", printLastReceipt)
    }
}

// Carregar produtos no grid
function loadProductsGrid() {
    const grid = document.getElementById("productsGrid")
    if (!grid) return

    grid.innerHTML = ""

    // Filtrar apenas produtos disponíveis (quantidade > 0)
    const availableProducts = stock.filter(item => item.quantity > 0)

    if (availableProducts.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                <i class="bi bi-box fs-1"></i>
                <p>Nenhum produto disponível</p>
            </div>
        `
        return
    }

    availableProducts.forEach(product => {
        const productCard = createProductCard(product)
        grid.appendChild(productCard)
    })
}

// Criar card de produto
function createProductCard(product) {
    const col = document.createElement("div")
    col.className = "col-md-6 col-lg-4 mb-2"

    const isLowStock = product.quantity <= 5
    const stockBadge = isLowStock ?
        `<span class="badge bg-warning text-dark">Estoque baixo</span>` :
        `<span class="badge bg-success">${product.quantity} disponível</span>`

    col.innerHTML = `
        <div class="card h-100 product-card service-listener-PDV" style="cursor: pointer;" data-service-id="${product.id}">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <h6 class="card-title mb-0 text-truncate" title="${product.name}">
                        ${product.name}
                    </h6>
                    ${stockBadge}
                </div>
                <p class="card-text small text-muted mb-1">
                    ${product.brand || ''} ${product.model || ''}
                </p>
                <p class="card-text small mb-1">
                    <strong>Código:</strong> ${product.code}
                </p>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-primary fw-bold">
                        ${formatCurrency(product.sale_price)}
                    </span>
                    <small class="text-muted">
                        ${product.category}
                    </small>
                </div>
            </div>
        </div>
    `

    return col
}

// Filtrar produtos
function filterProducts(searchTerm) {
    const products = document.querySelectorAll(".product-card")
    const term = searchTerm.toLowerCase()

    products.forEach(product => {
        const text = product.textContent.toLowerCase()
        const container = product.closest(".col-md-6")

        if (text.includes(term)) {
            container.style.display = "block"
        } else {
            container.style.display = "none"
        }
    })
}

// Adicionar produto por código
async function addProductByCode(code) {
    if (!code.trim()) return

    const product = stock.find(item =>
        item.code.toString() === code.toString() && item.quantity > 0
    )

    if (product) {
        addToCart(product.id)
        showToast(`${product.name} adicionado ao carrinho`, "success")
    } else {
        showToast("Produto não encontrado ou sem estoque", "error")
    }
}

// Adicionar produto ao carrinho
function addToCart(productId) {
    const product = stock.find(item => item.id === productId)

    if (!product || product.quantity <= 0) {
        showToast("Produto indisponível", "error")
        return
    }

    // Verificar se já existe no carrinho
    const existingItem = cart.find(item => item.id === productId)

    if (existingItem) {
        // Verificar se pode adicionar mais
        if (existingItem.quantity >= product.quantity) {
            showToast("Quantidade máxima atingida", "warning")
            return
        }
        existingItem.quantity += 1
    } else {
        cart.push({
            id: productId,
            name: product.name,
            code: product.code,
            price: product.sale_price,
            quantity: 1,
            maxQuantity: product.quantity
        })
    }

    updateCartDisplay()
    updateCartTotals()
}

// Remover produto do carrinho
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId)
    updateCartDisplay()
    updateCartTotals()
}

// Atualizar quantidade no carrinho
function updateCartQuantity(productId, quantity) {
    const item = cart.find(item => item.id === productId)
    if (!item) return

    if (quantity <= 0) {
        removeFromCart(productId)
        return
    }

    if (quantity > item.maxQuantity) {
        showToast("Quantidade excede o estoque", "warning")
        return
    }

    item.quantity = quantity
    updateCartDisplay()
    updateCartTotals()
}

// Atualizar display do carrinho
function updateCartDisplay() {
    const cartItems = document.getElementById("cartItems")
    if (!cartItems) return

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-cart fs-1"></i>
                <p>Carrinho vazio</p>
            </div>
        `
        document.getElementById("finalizeSale").disabled = true
        return
    }

    let html = ""
    cart.forEach(item => {
        html += `
            <div class="border-bottom pb-2 mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1 text-truncate" title="${item.name}">
                            ${item.name}
                        </h6>
                        <small class="text-muted">Código: ${item.code}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger ms-2" 
                            onclick="removeFromCart(${item.id})" title="Remover">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <div class="input-group input-group-sm" style="width: 100px;">
                        <button class="btn btn-outline-secondary" type="button" 
                                onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <input type="text" class="form-control text-center" 
                               value="${item.quantity}" readonly>
                        <button class="btn btn-outline-secondary" type="button" 
                                onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold">${formatCurrency(item.price * item.quantity)}</div>
                        <small class="text-muted">${formatCurrency(item.price)} cada</small>
                    </div>
                </div>
            </div>
        `
    })

    cartItems.innerHTML = html
    document.getElementById("finalizeSale").disabled = false
}

// Atualizar totais do carrinho
function updateCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const discountPercent = parseFloat(document.getElementById("discountPercent")?.value || 0)
    const discountAmount = (subtotal * discountPercent) / 100
    const total = subtotal - discountAmount

    document.getElementById("cartSubtotal").textContent = formatCurrency(subtotal)
    document.getElementById("cartTotal").textContent = formatCurrency(total)

    // Habilitar/desabilitar botão de finalizar
    const finalizeSaleBtn = document.getElementById("finalizeSale")
    if (finalizeSaleBtn) {
        finalizeSaleBtn.disabled = cart.length === 0 || total <= 0
    }
}

// Limpar carrinho
function clearCart() {
    if (cart.length === 0) return

    if (confirm("Deseja limpar o carrinho?")) {
        cart = []
        document.getElementById("pdvCustomerName").value = ""
        document.getElementById("discountPercent").value = ""
        updateCartDisplay()
        updateCartTotals()
        showToast("Carrinho limpo", "info")
    }
}

// Finalizar venda
async function finalizeSale() {
    if (cart.length === 0) {
        showToast("Carrinho vazio", "error")
        return
    }

    const customerName = document.getElementById("pdvCustomerName").value.trim()
    const paymentMethod = document.getElementById("paymentMethod").value
    const discountPercent = parseFloat(document.getElementById("discountPercent").value || 0)

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const discountAmount = (subtotal * discountPercent) / 100
    const total = subtotal - discountAmount

    if (total <= 0) {
        showToast("Valor total deve ser maior que zero", "error")
        return
    }

    try {
        // Criar a venda principal
        const saleData = {
            customer_name: customerName || "Cliente não identificado",
            total_amount: total,
            subtotal: subtotal,
            discount_percent: discountPercent,
            discount_amount: discountAmount,
            payment_method: paymentMethod,
            items: cart.map(item => ({
                stock_id: item.id,
                name: item.name,
                code: item.code,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity
            })),
            created_at: new Date().toISOString()
        }

        // Registrar cada item como venda individual (compatível com sua tabela sales)
        const salePromises = cart.map(async (item) => {
            const stockItem = stock.find(s => s.id === item.id)

            return db.addSale({
                device: item.name,
                brand: stockItem.brand,
                model: stockItem.model,
                condition: stockItem.state || "Usado",
                sale_price: item.price * item.quantity,
                customer_name: customerName || null,
                notes: `PDV - ${paymentMethod} - Desconto: ${discountPercent}%`,
                stock_item_id: item.id
            })
        })

        await Promise.all(salePromises)

        // Atualizar estoque
        const stockPromises = cart.map(async (item) => {
            const stockItem = stock.find(s => s.id === item.id)
            const newQuantity = stockItem.quantity - item.quantity

            return db.updateStock(item.id, {
                ...stockItem,
                quantity: newQuantity
            })
        })

        await Promise.all(stockPromises)

        // Registrar transação financeira
        await db.addTransaction({
            type: "entrada",
            category: "venda",
            description: `${cart.length} item(s)`,
            amount: total,
            status: "pago",
            customer_name: customerName || null
        })

        // Salvar venda atual para impressão
        currentSale = {
            ...saleData,
            id: Date.now(), // ID temporário
            date: new Date().toLocaleString("pt-BR")
        }

        // Limpar carrinho
        cart = []
        document.getElementById("pdvCustomerName").value = ""
        document.getElementById("discountPercent").value = ""

        // Atualizar displays
        updateDashboard()
        updateCartDisplay()
        updateCartTotals()
        await loadAllData() // Recarregar todos os dados
        updateTodaysSales()

        // Habilitar impressão
        document.getElementById("printReceipt").disabled = false

        showToast(`Venda finalizada! Total: ${formatCurrency(total)}`, "success")

    } catch (error) {
        console.error("Erro ao finalizar venda:", error)
        showToast("Erro ao finalizar venda", "error")
    }
}

// Atualizar vendas do dia
function updateTodaysSales() {
    const today = new Date().toDateString()
    const todaySales = sales.filter(sale =>
        new Date(sale.created_at).toDateString() === today
    )

    const todayTotal = todaySales.reduce((sum, sale) => sum + (sale.sale_price || 0), 0)

    document.getElementById("todayTotal").textContent = formatCurrency(todayTotal)
    document.getElementById("todayCount").textContent = todaySales.length

    // Atualizar tabela de vendas do dia
    updateTodaySalesTable(todaySales)
}

// Atualizar tabela de vendas do dia
function updateTodaySalesTable(todaySales) {
    const tbody = document.getElementById("todaySalesTable")
    if (!tbody) return

    if (todaySales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-3">
                    Nenhuma venda hoje
                </td>
            </tr>
        `
        return
    }

    tbody.innerHTML = todaySales.map(sale => {
        const time = new Date(sale.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
        })

        return `
            <tr>
                <td>${time}</td>
                <td>${sale.customer_name || "N/A"}</td>
                <td>${sale.device}</td>
                <td>${formatCurrency(sale.sale_price)}</td>
                <td>
                    <span class="badge bg-info">
                        ${getPaymentMethodText(sale.notes)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="reprintSaleReceipt(${sale.id})" title="Reimprimir">
                        <i class="bi bi-printer"></i>
                    </button>
                </td>
            </tr>
        `
    }).join("")
}

// Extrair método de pagamento das notas
function getPaymentMethodText(notes) {
    if (!notes) return "N/A"

    if (notes.includes("dinheiro")) return "Dinheiro"
    if (notes.includes("cartao")) return "Cartão"
    if (notes.includes("pix")) return "PIX"
    if (notes.includes("transferencia")) return "Transferência"

    return "Outros"
}

// Imprimir último recibo
function printLastReceipt() {
    if (!currentSale) {
        showToast("Nenhuma venda para imprimir", "warning")
        return
    }

    generateReceipt(currentSale)
}

// Reimprimir recibo de venda
function reprintSaleReceipt(saleId) {
    const sale = sales.find(s => s.id === saleId)
    if (!sale) {
        showToast("Venda não encontrada", "error")
        return
    }

    // Reconstituir dados da venda para impressão
    const saleForReceipt = {
        id: sale.id,
        customer_name: sale.customer_name,
        total_amount: sale.sale_price,
        payment_method: getPaymentMethodText(sale.notes),
        items: [{
            name: sale.device,
            quantity: 1,
            unit_price: sale.sale_price,
            total_price: sale.sale_price
        }],
        date: new Date(sale.created_at).toLocaleString("pt-BR")
    }

    generateReceipt(saleForReceipt)
}

// Gerar recibo para impressão
function generateReceipt(sale) {
    const receiptWindow = window.open("", "_blank", "width=300,height=600")

    const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Recibo - Venda #${sale.id}</title>
            <style>
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    margin: 10px;
                    line-height: 1.3;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px dashed #000;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }
                .item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                }
                .total {
                    border-top: 2px dashed #000;
                    padding-top: 10px;
                    margin-top: 15px;
                    font-weight: bold;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    border-top: 1px dashed #000;
                    padding-top: 10px;
                }
                @media print {
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>ASSISTÊNCIA TÉCNICA</h2>
                <p>Recibo de Venda</p>
                <p>Venda #${sale.id}</p>
                <p>${sale.date}</p>
            </div>

            <div>
                <strong>Cliente:</strong> ${sale.customer_name || "N/A"}<br>
                <strong>Pagamento:</strong> ${sale.payment_method || "N/A"}
            </div>

            <div style="margin: 15px 0;">
                <strong>ITENS:</strong>
            </div>

            ${sale.items.map(item => `
                <div class="item">
                    <div>
                        ${item.quantity}x ${item.name}<br>
                        <small>${formatCurrency(item.unit_price)}</small>
                    </div>
                    <div>${formatCurrency(item.total_price)}</div>
                </div>
            `).join("")}

            <div class="total">
                ${sale.subtotal ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(sale.subtotal)}</span>
                    </div>
                ` : ""}
                ${sale.discount_amount > 0 ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span>Desconto (${sale.discount_percent}%):</span>
                        <span>-${formatCurrency(sale.discount_amount)}</span>
                    </div>
                ` : ""}
                <div style="display: flex; justify-content: space-between; font-size: 14px;">
                    <span>TOTAL:</span>
                    <span>${formatCurrency(sale.total_amount)}</span>
                </div>
            </div>

            <div class="footer">
                <p>Obrigado pela preferência!</p>
                <small>Sistema de Gestão - PDV</small>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `

    receiptWindow.document.write(receiptHTML)
    receiptWindow.document.close()
}

// Função para mostrar toasts (notificações)
function showToast(message, type = "info") {
    // Criar elemento de toast se não existir
    let toastContainer = document.getElementById("toastContainer")
    if (!toastContainer) {
        toastContainer = document.createElement("div")
        toastContainer.id = "toastContainer"
        toastContainer.className = "position-fixed top-0 end-0 p-3"
        toastContainer.style.zIndex = "9999"
        document.body.appendChild(toastContainer)
    }

    const toastId = "toast_" + Date.now()
    const bgClass = {
        success: "bg-success",
        error: "bg-danger",
        warning: "bg-warning",
        info: "bg-info"
    }[type] || "bg-info"

    const toastHTML = `
        <div class="toast ${bgClass} text-white" id="${toastId}" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        onclick="document.getElementById('${toastId}').remove()">
                </button>
            </div>
        </div>
    `

    toastContainer.insertAdjacentHTML("beforeend", toastHTML)

    // Auto-remover após 3 segundos
    setTimeout(() => {
        const toast = document.getElementById(toastId)
        if (toast) toast.remove()
    }, 3000)
}