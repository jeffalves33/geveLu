// Arquivo: src/renderer/js/database.js
const SUPABASE_URL = "https://pohyklelteffixawmtga.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvaHlrbGVsdGVmZml4YXdtdGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzU5NjAsImV4cCI6MjA2ODgxMTk2MH0.1WKPold6UPfRKgV0u1cHc7JY4RGcvx46BVgtwIQ3CHw"

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

// Classe para gerenciar o banco de dados
class Database {
    constructor() {
        this.initializeTables()
    }

    async initializeTables() {
        try {
            // Verificar se as tabelas existem, se não, criar
            await this.createTablesIfNotExists()
            console.log("Database initialized successfully")
        } catch (error) {
            console.error("Error initializing database:", error)
        }
    }

    async createTablesIfNotExists() {
        // As tabelas devem ser criadas no Supabase Dashboard
        // Aqui apenas verificamos se existem
        const tables = ["services", "sales", "stock", "transactions"]

        for (const table of tables) {
            try {
                const { data, error } = await supabase.from(table).select("*").limit(1)

                if (error && error.code === "PGRST116") {
                    console.warn(`Table ${table} does not exist. Please create it in Supabase Dashboard.`)
                }
            } catch (err) {
                console.error(`Error checking table ${table}:`, err)
            }
        }
    }

    // Serviços
    async getServices() {
        try {
            const { data, error } = await supabase.
                from("services")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error("Error fetching services:", error)
            return []
        }
    }

    async createService(service) {
        try {
            const { data, error } = await supabase
                .from("services")
                .insert([
                    {
                        customer_name: service.customerName,
                        customer_phone: service.customerPhone,
                        device: service.device,
                        problem: service.problem,
                        value: service.value,
                        status: service.status || "Em andamento",
                        delivery_date: service.deliveryDate,
                        notes: service.notes,
                        used_parts: service.usedParts,
                        created_at: new Date().toISOString(),
                    },
                ])
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error creating service:", error)
            throw error
        }
    }

    async updateService(id, updates) {
        try {
            const { data, error } = await supabase.from("services").update(updates).eq("id", id).select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error updating service:", error)
            throw error
        }
    }

    async deleteService(id) {
        try {
            const { data, error } = await supabase
                .from("services")
                .delete()
                .eq("id", id)
                .select()

            if (error) throw error

            return data[0]
        } catch (error) {
            console.error("Error deleting service:", error)
            throw error
        }
    }

    // Vendas
    async getSales() {
        try {
            const { data, error } = await supabase.from("sales").select("*").order("created_at", { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error("Error fetching sales:", error)
            return []
        }
    }

    async createSale(sale) {
        try {
            const { data, error } = await supabase
                .from("sales")
                .insert([
                    {
                        device: sale.device,
                        brand: sale.brand,
                        model: sale.model,
                        storage: sale.storage,
                        condition: sale.condition,
                        purchase_price: sale.purchasePrice,
                        sale_price: sale.salePrice,
                        profit: sale.profit,
                        customer_name: sale.customerName,
                        notes: sale.notes,
                        stock_item_id: sale.stockItemId,
                        created_at: new Date().toISOString(),
                    },
                ])
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error creating sale:", error)
            throw error
        }
    }

    async deleteSale(id) {
        try {
            const { data, error } = await supabase
                .from("sales")
                .delete()
                .eq("id", id)
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error deleting sale:", error)
            throw error
        }
    }

    async updateSale(id, updates) {
        try {
            const { data, error } = await supabase
                .from("sales")
                .update(updates)
                .eq("id", id)
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error updating sale:", error)
            throw error
        }
    }

    // Estoque
    async getStock() {
        try {
            const { data, error } = await supabase.from("stock").select("*").order("name")

            if (error) throw error
            return data || []
        } catch (error) {
            console.error("Error fetching stock:", error)
            return []
        }
    }

    async createStockItem(item) {
        try {
            const { data, error } = await supabase
                .from("stock")
                .insert([
                    {
                        name: item.name,
                        code: item.code,
                        category: item.category,
                        state: item.state,
                        brand: item.brand,
                        model: item.model,
                        quantity: item.quantity,
                        purchase_price: item.purchasePrice,
                        sale_price: item.salePrice,
                        supplier: item.supplier,
                        location: item.location,
                        notes: item.notes,
                        created_at: new Date().toISOString(),
                    },
                ])
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error creating stock item:", error)
            throw error
        }
    }

    async updateStockQuantity(id, newQuantity, reason) {
        try {
            const { data, error } = await supabase
                .from("stock")
                .update({
                    quantity: newQuantity,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()

            if (error) throw error

            // Registrar movimentação
            await this.createStockMovement(id, newQuantity, reason)

            return data[0]
        } catch (error) {
            console.error("Error updating stock quantity:", error)
            throw error
        }
    }

    async createStockMovement(stockId, quantity, reason) {
        try {
            const { data, error } = await supabase.from("stock_movements").insert([
                {
                    stock_id: stockId,
                    quantity: quantity,
                    reason: reason,
                    created_at: new Date().toISOString(),
                },
            ])

            if (error) throw error
            return data
        } catch (error) {
            console.error("Error creating stock movement:", error)
        }
    }

    async updateStockItem(id, updates) {
        try {
            const { data, error } = await supabase
                .from("stock")
                .update(updates)
                .eq("id", id)
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error updating stock item:", error)
            throw error
        }
    }

    async deleteStockItem(id) {
        try {
            const { data: stock_movementsData, error: stock_movementsError } = await supabase
                .from("stock_movements")
                .delete()
                .eq("stock_id", id)
                .select()

            if (stock_movementsError) throw error

        } catch (error) {
            console.error("Error deleting stockstock_movements item:", stock_movementsError)
            throw error
        }

        try {
            const { data, error } = await supabase
                .from("stock")
                .delete()
                .eq("id", id)
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error deleting stock item:", error)
            throw error
        }
    }

    // Transações
    async getTransactions() {
        try {
            const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error("Error fetching transactions:", error)
            return []
        }
    }

    async createTransaction(transaction) {
        try {
            const { data, error } = await supabase
                .from("transactions")
                .insert([
                    {
                        type: transaction.type,
                        category: transaction.category,
                        description: transaction.description,
                        amount: transaction.amount,
                        status: transaction.status,
                        customer_name: transaction.customerName,
                        created_at: new Date().toISOString(),
                    },
                ])
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error creating transaction:", error)
            throw error
        }
    }

    async updateTransaction(id) {
        try {
            const { data, error } = await supabase
                .from("services")
                .update({
                    status: "Entregue",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()

            if (error) throw error

            return data[0]
        } catch (error) {
            console.error("Error updating stock quantity:", error)
            throw error
        }
    }

    async updateTransactionStatus(id) {
        try {
            const { data, error } = await supabase
                .from("transactions")
                .update({
                    status: "pago"
                })
                .eq("id", id)
                .select()

            if (error) throw error

            return data[0]
        } catch (error) {
            console.error("Error updating transaction status:", error)
            throw error
        }
    }

    async deleteTransaction(id) {
        try {
            const { data, error } = await supabase
                .from("transactions")
                .delete()
                .eq("id", id)
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error deleting transaction:", error)
            throw error
        }
    }

    async updateTransactionItem(id, updates) {
        try {
            const { data, error } = await supabase
                .from("transactions")
                .update(updates)
                .eq("id", id)
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error("Error updating transaction:", error)
            throw error
        }
    }

    // PDV
    async addSale(saleData) {
        try {
            const { data, error } = await supabase
                .from('sales')
                .insert([saleData])
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error('Error adding sale:', error)
            throw error
        }
    }

    async updateStock(id, stockData) {
        try {
            const { data, error } = await supabase
                .from('stock')
                .update(stockData)
                .eq('id', id)
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error('Error updating stock:', error)
            throw error
        }
    }

    async addTransaction(transactionData) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .insert([transactionData])
                .select()

            if (error) throw error
            return data[0]
        } catch (error) {
            console.error('Error adding transaction:', error)
            throw error
        }
    }
}

// Instância global do banco de dados
export const db = new Database()
