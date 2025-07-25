import { db } from './database.js'

// Variáveis globais
let services = []
let sales = []
let stock = []
let transactions = []
let selectedParts = []

// Inicialização da aplicação
document.addEventListener("DOMContentLoaded", () => {
    initializeApp()
    setupEventListeners()
})

async function initializeApp() {
    // Mostrar data atual
    document.getElementById("currentDate").textContent = new Date().toLocaleDateString("pt-BR")

    // Carregar dados
    await loadAllData()

    // Atualizar dashboard
    updateDashboard()
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
        // Botão de gerar PDF
        if (e.target.classList.contains('generate-pdf-btn')) {
            const serviceId = e.target.getAttribute('data-service-id');
            generateServicePDF(serviceId);
        }

        // Botão de atualizar estoque
        if (e.target.classList.contains('update-stock-btn')) {
            const itemId = e.target.getAttribute('data-item-id');
            openStockUpdateModal(itemId);
        }

        if (e.target.classList.contains('update-transaction-btn')) {
            const itemId = e.target.getAttribute('data-transaction-id');
            updateTransactionStatus(itemId);
        }
    });
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
    const totalStockValue = stock.reduce((sum, item) => sum + item.quantity * item.purchase_price, 0)
    const outOfStockItems = stock.filter((item) => item.quantity === 0).length

    document.getElementById("totalStockItems").textContent = totalStockItems
    document.getElementById("lowStockCount").textContent = totalStockItems
    document.getElementById("totalStockTypes").textContent = `${stock.length} tipos diferentes`
    document.getElementById("totalStockValue").textContent = formatCurrency(totalStockValue)
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
                    <button class="btn btn-outline-primary btn-sm generate-pdf-btn" data-service-id="${service.id}">
                        <i class="bi bi-file-pdf"></i>
                    </button>
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
            <td>${formatCurrency(sale.purchase_price)}</td>
            <td>${formatCurrency(sale.sale_price)}</td>
            <td class="${sale.profit > 0 ? "text-success" : "text-danger"}">
                ${formatCurrency(sale.profit)}
            </td>
            <td>${formatDate(sale.created_at)}</td>
            <td>${sale.customer_name || "-"}</td>
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
            <td>${item.location || "-"}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm update-stock-btn" data-item-id="${item.id}">
                    Atualizar
                </button>
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
        option.textContent = `${part.name} - ${formatCurrency(part.unit_price)}`
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
        const serviceData = {
            customerName: document.getElementById("customerName").value,
            customerPhone: document.getElementById("customerPhone").value,
            device: document.getElementById("device").value,
            problem: document.getElementById("problem").value,
            value: Number.parseFloat(document.getElementById("serviceValue").value),
            deliveryDate: document.getElementById("deliveryDate").value,
            notes: document.getElementById("serviceNotes").value,
            usedParts: selectedParts,
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
        for (const part of selectedParts) {
            const stockItem = stock.find((item) => item.id == part.id)
            if (stockItem) {
                const newQuantity = stockItem.quantity - part.quantity
                await db.updateStockQuantity(part.id, newQuantity, `Usado em serviço #${newService.id}`)
                stockItem.quantity = newQuantity
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
        alert("Erro ao cadastrar serviço. Tente novamente.")
    }
}

async function saveSale() {
    try {
        const saleType = document.querySelector('input[name="saleType"]:checked').value
        let saleData

        if (saleType === "stock") {
            const stockItemId = document.getElementById("stockDeviceSelect").value
            const stockItem = stock.find((item) => item.id == stockItemId)

            if (!stockItem) {
                alert("Selecione um aparelho do estoque")
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
        alert("Erro ao registrar venda. Tente novamente.")
    }
}

async function saveTransaction() {
    try {
        const type = document.getElementById("type").value
        const category = document.getElementById("transactionCategory").value
        const description = document.getElementById("transactionDescription").value
        const customerName = document.getElementById("transactionCustomerName").value
        const value = Number.parseFloat(document.getElementById("value").value) || 0

        // Validações básicas
        if (!type) {
            alert("Selecione o tipo da transação")
            return
        }

        if (!category) {
            alert("Selecione a categoria da transação")
            return
        }

        if (value <= 0) {
            alert("Informe um valor válido")
            return
        }

        // Validação específica: Compra só pode ser Saída
        if (category === "compra" && type !== "saida") {
            alert("Categoria 'Compra' só pode ser usada com tipo 'Saída'")
            return
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
        alert("Erro ao registrar transação. Tente novamente.")
    }
}

async function saveStock() {
    try {
        const stockData = {
            name: document.getElementById("itemName").value,
            category: document.getElementById("category").value,
            state: document.getElementById("state").value,
            brand: document.getElementById("itemBrand").value,
            model: document.getElementById("itemModel").value,
            quantity: Number.parseInt(document.getElementById("quantity").value),
            purchasePrice: Number.parseFloat(document.getElementById("purchasePriceStock").value),
            salePrice: Number.parseFloat(document.getElementById("salePriceStock").value),
            supplier: document.getElementById("supplier").value,
            location: document.getElementById("location").value,
            notes: document.getElementById("stockNotes").value,
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

    } catch (error) {
        console.error("Error saving stock item:", error)
        alert("Erro ao cadastrar item. Tente novamente.")
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

        updateDashboard()
        updateFinancialTables()
    } catch (error) {
        console.error("Error updating service status:", error)
        alert("Erro ao atualizar status do serviço.")
    }
}

async function updateTransactionStatus(transactionId) {
    try {
        await db.updateTransactionStatus(transactionId)

        updateDashboard()
        updateFinancialTables()
    } catch (error) {
        console.error("Error updating service status:", error)
        alert("Erro ao atualizar status do serviço.")
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
        const quantity = Number.parseInt(document.getElementById("movementQuantity").value)
        const reason = document.getElementById("movementReason").value

        const item = stock.find((s) => s.id == itemId)
        if (!item) return

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
        alert("Erro ao atualizar estoque. Tente novamente.")
    }
}

function generateServicePDF(serviceId) {
    try {
        // Informações da empresa (personalize com seus dados)
        const companyInfo = {
            name: 'ASSISTÊNCIA TÉCNICA',
            subtitle: 'Serviços especializados em smartphones',
            phone: '(27) 99999-9999',
            email: 'contato@assistencia.com',
            address: 'São Mateus - ES'
        };

        // Encontrar o serviço
        const service = services.find(s => s.id == serviceId);
        if (!service) {
            alert('Serviço não encontrado');
            return;
        }

        // Criar nova instância do jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Configurações de cores
        const primaryColor = [51, 122, 183]; // Azul
        const secondaryColor = [108, 117, 125]; // Cinza
        const textColor = [33, 37, 41]; // Preto

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

        // Título do documento
        doc.setTextColor(...textColor);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('ORDEM DE SERVIÇO', 20, 45);

        // Número da OS e data
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`OS Nº: #${service.id}`, 20, 55);
        doc.text(`Data: ${formatDate(service.created_at || new Date())}`, 130, 55);

        // Linha separadora
        doc.setDrawColor(...secondaryColor);
        doc.line(20, 60, 190, 60);

        // Dados do cliente
        let yPosition = 70;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DADOS DO CLIENTE', 20, yPosition);

        yPosition += 10;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        // Caixa para dados do cliente
        doc.setDrawColor(200, 200, 200);
        doc.rect(20, yPosition - 5, 170, 25);

        doc.text(`Nome: ${service.customer_name}`, 25, yPosition + 2);
        doc.text(`Telefone: ${service.customer_phone}`, 25, yPosition + 8);
        doc.text(`Aparelho: ${service.device}`, 25, yPosition + 14);

        // Descrição do problema
        yPosition += 35;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DESCRIÇÃO DO PROBLEMA', 20, yPosition);

        yPosition += 10;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        // Caixa para descrição do problema
        doc.rect(20, yPosition - 5, 170, 20);
        doc.text(`${service.problem}`, 25, yPosition + 2);

        // Peças utilizadas (se houver)
        if (service.used_parts && service.used_parts.length > 0) {
            yPosition += 35;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('PEÇAS UTILIZADAS', 20, yPosition);

            yPosition += 10;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');

            // Cabeçalho da tabela de peças
            doc.setFillColor(240, 240, 240);
            doc.rect(20, yPosition - 3, 170, 8, 'F');
            doc.text('Item', 25, yPosition + 2);
            doc.text('Qtd', 130, yPosition + 2);
            doc.text('Valor Unit.', 150, yPosition + 2);
            doc.text('Total', 175, yPosition + 2);

            yPosition += 10;
            let totalParts = 0;

            service.used_parts.forEach((part, index) => {
                const partTotal = part.quantity * part.salePrice;
                totalParts += partTotal;

                doc.text(`${part.name}`, 25, yPosition);
                doc.text(`${part.quantity}`, 130, yPosition);
                doc.text(`R$ ${part.salePrice.toFixed(2)}`, 150, yPosition);
                doc.text(`R$ ${partTotal.toFixed(2)}`, 175, yPosition);

                yPosition += 6;
            });

            // Total das peças
            doc.setFont('helvetica', 'bold');
            doc.text(`Total Peças: R$ ${totalParts.toFixed(2)}`, 150, yPosition + 5);
            yPosition += 15;
        }

        // Informações do serviço
        yPosition += 30;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMAÇÕES DO SERVIÇO', 20, yPosition);

        yPosition += 10;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        // Caixa para informações do serviço
        doc.rect(20, yPosition - 5, 170, 30);

        doc.text(`Valor do Serviço: R$ ${(service.value || 0).toFixed(2)}`, 25, yPosition + 2);
        doc.text(`Data de Entrega Prevista: ${service.delivery_date ? formatDate(service.delivery_date) : 'A definir'}`, 25, yPosition + 8);
        doc.text(`Status: ${service.status}`, 25, yPosition + 14);

        if (service.notes) {
            doc.text(`Observações: ${service.notes}`, 25, yPosition + 20);
        }

        // Termos e condições
        yPosition += 45;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('TERMOS E CONDIÇÕES', 20, yPosition);

        yPosition += 8;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const terms = [
            '• O prazo de entrega pode ser alterado em caso de necessidade de importação de peças.',
            '• O cliente tem 30 dias de garantia para defeitos relacionados ao serviço executado.',
            '• Equipamentos não retirados em até 90 dias serão considerados abandonados.',
            '• A empresa não se responsabiliza por dados perdidos durante o reparo.'
        ];

        terms.forEach(term => {
            doc.text(term, 20, yPosition);
            yPosition += 5;
        });

        // Área de assinatura
        yPosition += 15;
        doc.setDrawColor(...secondaryColor);

        // Linha para assinatura do cliente
        doc.line(20, yPosition, 90, yPosition);
        doc.setFontSize(10);
        doc.text('Assinatura do Cliente', 20, yPosition + 8);
        doc.text(`Data: ____/____/______`, 20, yPosition + 15);

        // Linha para assinatura do técnico
        doc.line(120, yPosition, 190, yPosition);
        doc.text('Assinatura do Técnico', 120, yPosition + 8);
        doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 120, yPosition + 15);

        // Rodapé
        doc.setFontSize(8);
        doc.setTextColor(...secondaryColor);
        doc.text('Este documento foi gerado automaticamente pelo sistema de gestão.', 20, 285);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 120, 285);

        // Salvar o PDF
        const fileName = `OS_${serviceId}_${service.customer_name.replace(/\s+/g, '_')}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Verifique se a biblioteca jsPDF está carregada.');
    }
}
// Funções auxiliares
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