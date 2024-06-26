const express = require("express");
const router = express.Router();
const moment = require("moment");
const { User, Expense, Budget, Category } = require("../models/db");


// /getAllBudgets
router.get("/getUserBudgets", async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findOne({ _id: userId }).populate({
      path: "budgets",
      populate: {
        path: "categories",
        model: "Category",
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allBudgets = user.budgets;

    res.status(200).json(allBudgets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// /addExpense
router.post("/addUserExpense", async (req, res) => {
  console.log(req.body);
  try {
    const { categoryId, description, amount, date } = req.body;

    if (!categoryId) {
      return res.status(400).json({ message: "Category ID is required" });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const newExpense = new Expense({
      description,
      amount,
      date: date ? new Date(date) : new Date(),
    });

    const savedExpense = await newExpense.save();

    category.expenses.push(savedExpense._id);
    await category.save();

    res.status(200).json({ message: "Expense added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// /getAllExpenses
router.get("/getUserExpense", async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate({
      path: "budgets",
      populate: {
        path: "categories",
        populate: {
          path: "expenses",
          model: "Expense",
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allExpenses = [];

    // Iterate through budgets and categories to collect expenses
    user.budgets.forEach((budget) => {
      budget.categories.forEach((category) => {
        category.expenses.forEach((expense) => {
          console.log(category.name);

          const newExpense = {
            amount: expense.amount,
            date: expense.date,
            description: expense.description,
            _id: expense._id,
            categoryName: category.name,
          };
          allExpenses.push(newExpense);
        });
      });
    });

    res.status(200).json(allExpenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// /addCategoryToBudget
router.post("/addCategoryToUserBudget", async (req, res) => {
  try {
    const { budgetId, name, allocatedAmount, spend } = req.body;

    if (!budgetId) {
      return res.status(400).json({ message: "Budget ID is required" });
    }

    const budget = await Budget.findById(budgetId);

    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }

    const newCategory = new Category({
      name,
      allocatedAmount,
      spend: spend || 0,
    });

    const savedCategory = await newCategory.save();

    budget.categories.push(savedCategory._id);
    await budget.save();

    res.status(200).json({ message: "Category added to budget successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});
// /addBudget
router.post("/addUserBudget", async (req, res) => {
  try {
    const { name, totalAmount, startDate, endDate } = req.body;
    console.log(req.body);
    const newBudget = new Budget({
      name,
      totalAmount,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    const user = await User.findById(req.user.id);
    user.budgets.push(newBudget._id);
    await user.save();

    const savedBudget = await newBudget.save();

    res
      .status(200)
      .json({ message: "Budget added successfully", budget: savedBudget });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// /deleteExpense
router.post("/deleteUserExpense", async (req, res) => {
  try {
    const { expenseId } = req.body;

    if (!expenseId) {
      return res.status(400).json({ message: "Expense ID is required" });
    }

    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const categoryId = expense.category;

    // Delete the expense
    await Expense.findByIdAndDelete(expenseId);

    // Update the category's expenses array
    const category = await Category.findById(categoryId);
    if (category) {
      category.expenses.pull(expenseId);
      await category.save();
    }

    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// /deleteCategory
router.post("/deleteUserCategory", async (req, res) => {
  try {
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({ message: "Category ID is required" });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    //find budget id in user account categories is refrecend in budget using ref
    // const budgetId = category.budget;
    const ExpenseIds = category.expenses;
    // Delete the category
    await Category.findByIdAndDelete(categoryId);

    // Update the budget's categories array
    const budget = await Budget.find({ categories: categoryId });
    if (budget) {
      budget[0].categories.pull(categoryId);
      await budget[0].save();
    }
    // delete all expenses in the category
    await Expense.deleteMany({ _id: { $in: ExpenseIds } });

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/getUserExpensesSortedByMonthlyDate", async (req, res) => {
  try {
    const userId = req.user.id; // Assuming you have a user ID available in req.user

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Find the user by ID, populating budgets
    const user = await User.findById(userId).populate({
      path: "budgets",
      populate: {
        path: "categories",
        populate: {
          path: "expenses",
          model: "Expense",
        },
      },
    });

    // Calculate total amount spent each day
    const dailyExpenses = {};
    user.budgets.forEach((budget) => {
      budget.categories.forEach((category) => {
        category.expenses.forEach((expense) => {
          const formattedDate = moment(expense.date).format("YYYY-MM-DD");

          if (!dailyExpenses[formattedDate]) {
            dailyExpenses[formattedDate] = {
              date: formattedDate,
              totalAmountSpent: 0,
            };
          }

          dailyExpenses[formattedDate].totalAmountSpent += expense.amount;
        });
      });
    });

    // Convert the daily expenses object to an array
    const result = Object.values(dailyExpenses);

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
