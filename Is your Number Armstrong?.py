For this challenge, you need to take an integer input and store it in a variable of your choice and checks whether this number is an Armstrong number or not. If yes print 'True' else print 'False'. 

Input Format
A single integer value to be taken as input from stdin and stored it in a variable. 

Constraints
1 < = n < = 18

Output Format
print 'True' if your number is Armstrong otherwise print 'False' to the stdout. 
Explanation

It is a armstrong Number as 3^3 + 7^3 + 0^3 = 370.


def main():

 number = input()
 sum_array = []
 for i in range(len(number)):
     num = int(number[i])
     num2 = num ** len(number)
     sum_array.append(num2)
 if sum(sum_array) == int(number):
     print('True', end = "")
 else:
     print('False', end = "")


main()
